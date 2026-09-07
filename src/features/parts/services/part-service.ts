// ───────────────── BLOCK 1: Imports ────────────────────────────
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
  FilterItem,
  Option,
} from "@/components/shared/data-table/types"
import type { Part } from "../types/part-schema"

// ───────────────── BLOCK 2: Constants ──────────────────────────
// Whitelist of columns allowed through to Prisma for server-side sorting.
const SORTABLE_COLUMNS = new Set([
  "part_code",
  "part_description",
  "part_type",
  "per_shipper",
  "product_code",
])

/** Columns filterable as free text (string filters). */
type TextField = "part_code" | "part_description" | "part_type"

const TEXT_FIELDS = new Set<TextField>([
  "part_code",
  "part_description",
  "part_type",
])

// ───────────────── BLOCK 3: Mapper ─────────────────────────────
type BomComponentWithProduct = Prisma.bom_componentsGetPayload<{
  include: { products: { select: { product_code: true } } }
}>

/**
 * Maps a Prisma bom_components row (with its parent product) to the
 * app-level Part type. Decimal -> number, relation -> flat product_code.
 */
function mapToPart(p: BomComponentWithProduct): Part {
  return {
    id: p.id,
    part_code: p.part_code,
    part_description: p.part_description,
    part_type: p.part_type,
    per_shipper: p.per_shipper === null ? null : Number(p.per_shipper),
    product_id: p.product_id,
    product_code: p.products?.product_code ?? null,
  }
}

// ───────────────── BLOCK 4: Where Builder ──────────────────────
/**
 * Translates a DataTableRequest into a Prisma where clause.
 * Global search is ANDed with the filter group; filters inside the group
 * are joined by the request's joinOperator (and | or). Search covers the
 * part's own fields AND its parent product code.
 */
function buildWhere(params: DataTableRequest): Prisma.bom_componentsWhereInput {
  const where: Prisma.bom_componentsWhereInput = {}
  const andGroups: Prisma.bom_componentsWhereInput[] = []

  if (params.search) {
    const term = params.search
    andGroups.push({
      OR: [
        { part_code: { contains: term, mode: "insensitive" } },
        { part_description: { contains: term, mode: "insensitive" } },
        { part_type: { contains: term, mode: "insensitive" } },
        {
          products: {
            is: { product_code: { contains: term, mode: "insensitive" } },
          },
        },
      ],
    })
  }

  const conditions = params.filters
    .map(buildFieldCondition)
    .filter((c): c is Prisma.bom_componentsWhereInput => c !== null)

  if (conditions.length > 0) {
    andGroups.push(
      params.joinOperator === "or" ? { OR: conditions } : { AND: conditions }
    )
  }

  if (andGroups.length > 0) where.AND = andGroups
  return where
}

// ───────────────── BLOCK 5: Filter Translation ─────────────────
/**
 * Translates one FilterItem into a where fragment. Returns null for
 * unknown columns / unsupported operator+column combinations, which are
 * ignored rather than throwing (fail-soft, whitelisted columns only).
 */
function buildFieldCondition(f: FilterItem): Prisma.bom_componentsWhereInput | null {
  const { id, operator } = f
  const value = f.value

  // ── Virtual boolean: is_linked (part belongs to a product) ──
  if (id === "is_linked") {
    if (operator === "equals") {
      return toBoolean(value)
        ? { product_id: { not: null } }
        : { product_id: null }
    }
    if (operator === "notEquals") {
      return toBoolean(value)
        ? { product_id: null }
        : { product_id: { not: null } }
    }
    // Faceted multi-select sends { operator: "contains", value: string[] }
    if (operator === "contains" && Array.isArray(value)) {
      const bools = value.map(toBoolean)
      if (bools.length === 0) return null
      if (bools.length === 1) {
        return bools[0] ? { product_id: { not: null } } : { product_id: null }
      }
      // Both Linked and Unlinked selected → no constraint
      return null
    }
    return null
  }

  // ── Relation text: product_code (parent product's code) ──
  if (id === "product_code") {
    const term = value == null ? "" : String(value)
    switch (operator) {
      case "iLike":
        return {
          products: {
            is: { product_code: { contains: term, mode: "insensitive" } },
          },
        }
      case "notILike":
        return {
          NOT: {
            products: {
              is: { product_code: { contains: term, mode: "insensitive" } },
            },
          },
        }
      case "equals":
        return {
          products: {
            is: { product_code: { equals: term, mode: "insensitive" } },
          },
        }
      case "notEquals":
        return {
          NOT: {
            products: {
              is: { product_code: { equals: term, mode: "insensitive" } },
            },
          },
        }
      case "startsWith":
        return {
          products: {
            is: { product_code: { startsWith: term, mode: "insensitive" } },
          },
        }
      case "endsWith":
        return {
          products: {
            is: { product_code: { endsWith: term, mode: "insensitive" } },
          },
        }
      // No parent product linked = "empty" for this column
      case "isEmpty":
        return { product_id: null }
      case "isNotEmpty":
        return { product_id: { not: null } }
      default:
        return null
    }
  }

  // ── Number column: per_shipper (nullable) ──
  if (id === "per_shipper") {
    const n = Number(value)
    switch (operator) {
      case "equals":
        return { per_shipper: { equals: n } }
      case "notEquals":
        return { NOT: { per_shipper: { equals: n } } }
      case "gt":
        return { per_shipper: { gt: n } }
      case "gte":
        return { per_shipper: { gte: n } }
      case "lt":
        return { per_shipper: { lt: n } }
      case "lte":
        return { per_shipper: { lte: n } }
      case "isBetween":
        if (Array.isArray(value) && value.length === 2) {
          return { per_shipper: { gte: Number(value[0]), lte: Number(value[1]) } }
        }
        return null
      case "isEmpty":
        return { per_shipper: { equals: null } }
      case "isNotEmpty":
        return { NOT: { per_shipper: { equals: null } } }
      default:
        return null
    }
  }

  // ── Text columns ──
  if (!TEXT_FIELDS.has(id as TextField)) return null
  const field = id as TextField
  const term = value == null ? "" : String(value)

  switch (operator) {
    case "iLike":
      return textFieldWhere(field, { contains: term, mode: "insensitive" })
    case "notILike":
      return textFieldWhere(field, { contains: term }, true)
    case "equals":
      return textFieldWhere(field, { equals: term, mode: "insensitive" })
    case "notEquals":
      return textFieldWhere(field, { equals: term }, true)
    case "startsWith":
      return textFieldWhere(field, { startsWith: term, mode: "insensitive" })
    case "endsWith":
      return textFieldWhere(field, { endsWith: term, mode: "insensitive" })
    case "contains":
      // Faceted multi-select sends an array; single values behave like iLike.
      return Array.isArray(value)
        ? textFieldWhere(field, { in: value.map(String) })
        : textFieldWhere(field, { contains: term, mode: "insensitive" })
    case "notContains":
      return Array.isArray(value)
        ? textFieldWhere(field, { in: value.map(String) }, true)
        : null
    case "isEmpty":
      return textEmptyWhere(field, true)
    case "isNotEmpty":
      return textEmptyWhere(field, false)
    default:
      return null
  }
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "true"
}

/**
 * Wraps a string filter under its (whitelisted) field name.
 * negate=true inverts it: NOT (field <op> value).
 */
function textFieldWhere(
  field: TextField,
  filter: Prisma.StringFilter,
  negate = false
): Prisma.bom_componentsWhereInput {
  switch (field) {
    case "part_code": return negate ? { NOT: { part_code: filter } } : { part_code: filter }
    case "part_description": return negate ? { NOT: { part_description: filter } } : { part_description: filter }
    case "part_type": return negate ? { NOT: { part_type: filter } } : { part_type: filter }
  }
}

/** Empty = "" or NULL. Not empty = neither. */
function textEmptyWhere(field: TextField, isEmpty: boolean): Prisma.bom_componentsWhereInput {
  const blank = { OR: [{ [field]: { equals: "" } }, { [field]: { equals: null } }] } as Prisma.bom_componentsWhereInput
  return isEmpty ? blank : { NOT: blank }
}

// ───────────────── BLOCK 6: Service Functions ──────────────────
/**
 * Fetches one page of parts (bom_components) for the shared DataTable.
 * Supports server-side pagination, sorting (whitelisted columns),
 * global search, and column filters.
 */
export async function getPartsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Part>> {
  const { page, pageSize, sorts } = params

  // Drop any sort request for columns that are not whitelisted.
  const safeSorts = sorts.filter((s) => SORTABLE_COLUMNS.has(s.id))

  const orderBy: Prisma.bom_componentsOrderByWithRelationInput[] = safeSorts.length
    ? safeSorts.map((s) => {
        // Sorting by the parent product's code goes through the relation.
        if (s.id === "product_code") {
          return {
            products: { product_code: s.desc ? "desc" : "asc" },
          } as Prisma.bom_componentsOrderByWithRelationInput
        }
        return { [s.id]: s.desc ? "desc" : "asc" } as Prisma.bom_componentsOrderByWithRelationInput
      })
    : [{ part_code: "asc" }]

  const where = buildWhere(params)

  const [parts, totalCount] = await Promise.all([
    prisma.bom_components.findMany({
      where,
      include: { products: { select: { product_code: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
    prisma.bom_components.count({ where }),
  ])

  return {
    data: parts.map(mapToPart),
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    totalCount,
  }
}

// ───────────────── BLOCK 7: Stats ──────────────────────────────
export interface PartStats {
  total: number
  linked: number
  unlinked: number
  missingQuantity: number
}

/**
 * Header KPIs for the parts page — four parallel aggregate queries,
 * no row fetching. "Unlinked" parts have no parent product; "missing
 * quantity" parts have no per_shipper value (incomplete BOM data).
 */
export async function getPartStats(): Promise<PartStats> {
  const [total, linked, unlinked, missingQuantity] = await Promise.all([
    prisma.bom_components.count(),
    prisma.bom_components.count({ where: { product_id: { not: null } } }),
    prisma.bom_components.count({ where: { product_id: null } }),
    prisma.bom_components.count({ where: { per_shipper: null } }),
  ])

  return { total, linked, unlinked, missingQuantity }
}

// ───────────────── BLOCK 8: Filter Options ─────────────────────
export interface PartFilterOptions {
  partTypes: Option[]
}

/**
 * Distinct part_type values with row counts, feeding the searchable
 * select filter on the parts table. NULL part types are excluded —
 * the column's "is empty" operator covers those.
 */
export async function getPartFilterOptions(): Promise<PartFilterOptions> {
  const groups = await prisma.bom_components.groupBy({
    by: ["part_type"],
    where: { part_type: { not: null } },
    _count: { _all: true },
    orderBy: { part_type: "asc" },
  })

  return {
    partTypes: groups.map((g) => ({
      label: g.part_type as string,
      value: g.part_type as string,
      count: g._count._all,
    })),
  }
}
