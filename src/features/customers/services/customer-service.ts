// ───────────────── BLOCK 1: Imports ────────────────────────────
import { prisma } from "@/lib/db"
import type { Customer as PrismaCustomer } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
  FilterItem,
  FilterOperator,
} from "@/components/shared/data-table/types"
import type { Customer } from "../types/customer-schema"

// ───────────────── BLOCK 2: Constants ──────────────────────────
// Whitelist of columns allowed through to Prisma for server-side sorting.
// Prevents arbitrary field names from reaching the query layer.
const SORTABLE_COLUMNS = new Set([
  "customer_code",
  "legal_name",
  "trading_name",
  "status",
  "customer_type",
  "industry",
  "payment_terms",
  "credit_limit",
  "created_at",
  "updated_at",
])

/** Columns filterable as free text (string filters). */
type TextField =
  | "customer_code"
  | "legal_name"
  | "trading_name"
  | "status"
  | "customer_type"
  | "industry"
  | "payment_terms"

const TEXT_FIELDS = new Set<TextField>([
  "customer_code",
  "legal_name",
  "trading_name",
  "status",
  "customer_type",
  "industry",
  "payment_terms",
])

// ───────────────── BLOCK 3: Mapper ─────────────────────────────
/**
 * Maps a Prisma Customer record to the app-level Customer type.
 * Prisma Decimal -> number, Date -> ISO string (JSON-safe for client components).
 */
function mapToCustomer(c: PrismaCustomer): Customer {
  return {
    id: c.id,
    customer_code: c.customer_code,
    legal_name: c.legal_name,
    trading_name: c.trading_name,
    status: c.status,
    customer_type: c.customer_type,
    industry: c.industry,
    payment_terms: c.payment_terms,
    credit_limit: Number(c.credit_limit),
    default_currency: c.default_currency,
    is_active: c.is_active,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }
}

// ───────────────── BLOCK 4: Where Builder ──────────────────────
/**
 * Translates a DataTableRequest into a Prisma where clause.
 * Global search is ANDed with the filter group; filters inside the group
 * are joined by the request's joinOperator (and | or).
 */
function buildWhere(params: DataTableRequest): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {}
  const andGroups: Prisma.CustomerWhereInput[] = []

  // Global search — case-insensitive across the customer's identity fields.
  if (params.search) {
    const term = params.search
    andGroups.push({
      OR: [
        { customer_code: { contains: term, mode: "insensitive" } },
        { legal_name: { contains: term, mode: "insensitive" } },
        { trading_name: { contains: term, mode: "insensitive" } },
        { industry: { contains: term, mode: "insensitive" } },
      ],
    })
  }

  const conditions = params.filters
    .map(buildFieldCondition)
    .filter((c): c is Prisma.CustomerWhereInput => c !== null)

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
function buildFieldCondition(f: FilterItem): Prisma.CustomerWhereInput | null {
  const { id, operator } = f
  const value = f.value

  // ── Boolean column: is_active ──
  if (id === "is_active") {
    if (operator === "equals") {
      return { is_active: { equals: toBoolean(value) } }
    }
    if (operator === "notEquals") {
      return { NOT: { is_active: { equals: toBoolean(value) } } }
    }
    // Faceted multi-select sends { operator: "contains", value: string[] }.
    // BoolFilter has no "in" — express the selection as OR of equals.
    if (operator === "contains" && Array.isArray(value)) {
      const bools = value.map(toBoolean)
      if (bools.length === 0) return null
      if (bools.length === 1) {
        return { is_active: { equals: bools[0] } }
      }
      return { OR: bools.map((b) => ({ is_active: { equals: b } })) }
    }
    return null
  }

  // ── Number column: credit_limit ──
  if (id === "credit_limit") {
    const n = Number(value)
    switch (operator) {
      case "equals":
        return { credit_limit: { equals: n } }
      case "notEquals":
        return { NOT: { credit_limit: { equals: n } } }
      case "gt":
        return { credit_limit: { gt: n } }
      case "gte":
        return { credit_limit: { gte: n } }
      case "lt":
        return { credit_limit: { lt: n } }
      case "lte":
        return { credit_limit: { lte: n } }
      case "isBetween":
        if (Array.isArray(value) && value.length === 2) {
          return { credit_limit: { gte: Number(value[0]), lte: Number(value[1]) } }
        }
        return null
      default:
        return null
    }
  }

  // ── Date column: created_at (values arrive as ms-epoch strings) ──
  if (id === "created_at") {
    const toDate = (v: unknown) => new Date(Number(v))
    const dayStart = (v: unknown) => {
      const d = toDate(v)
      d.setHours(0, 0, 0, 0)
      return d
    }
    const dayEnd = (v: unknown) => {
      const d = toDate(v)
      d.setHours(23, 59, 59, 999)
      return d
    }
    switch (operator) {
      case "equals":
        return { created_at: { gte: dayStart(value), lte: dayEnd(value) } }
      case "notEquals":
        return { NOT: { created_at: { gte: dayStart(value), lte: dayEnd(value) } } }
      case "gt":
        return { created_at: { gt: toDate(value) } }
      case "gte":
        return { created_at: { gte: toDate(value) } }
      case "lt":
        return { created_at: { lt: toDate(value) } }
      case "lte":
        return { created_at: { lte: toDate(value) } }
      case "isBetween":
        if (Array.isArray(value) && value.length === 2) {
          return { created_at: { gte: toDate(value[0]), lte: toDate(value[1]) } }
        }
        return null
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
): Prisma.CustomerWhereInput {
  switch (field) {
    case "customer_code": return negate ? { NOT: { customer_code: filter } } : { customer_code: filter }
    case "legal_name": return negate ? { NOT: { legal_name: filter } } : { legal_name: filter }
    case "trading_name": return negate ? { NOT: { trading_name: filter } } : { trading_name: filter }
    case "status": return negate ? { NOT: { status: filter } } : { status: filter }
    case "customer_type": return negate ? { NOT: { customer_type: filter } } : { customer_type: filter }
    case "industry": return negate ? { NOT: { industry: filter } } : { industry: filter }
    case "payment_terms": return negate ? { NOT: { payment_terms: filter } } : { payment_terms: filter }
  }
}

/** Empty = "" or NULL. Not empty = neither. */
function textEmptyWhere(field: TextField, isEmpty: boolean): Prisma.CustomerWhereInput {
  const blank = { OR: [{ [field]: { equals: "" } }, { [field]: { equals: null } }] } as Prisma.CustomerWhereInput
  return isEmpty ? blank : { NOT: blank }
}

// ───────────────── BLOCK 6: Service Functions ──────────────────
/**
 * Fetches one page of customers for the shared DataTable.
 * Supports server-side pagination, sorting (whitelisted columns),
 * global search, and column filters.
 */
export async function getCustomersPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Customer>> {
  const { page, pageSize, sorts } = params

  // Drop any sort request for columns that are not whitelisted.
  const safeSorts = sorts.filter((s) => SORTABLE_COLUMNS.has(s.id))

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = safeSorts.length
    ? safeSorts.map(
        (s) =>
          ({ [s.id]: s.desc ? "desc" : "asc" }) as Prisma.CustomerOrderByWithRelationInput
      )
    : [{ created_at: "desc" }]

  const where = buildWhere(params)

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
    prisma.customer.count({ where }),
  ])

  return {
    data: customers.map(mapToCustomer),
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    totalCount,
  }
}

// ───────────────── BLOCK 7: Stats ──────────────────────────────
export interface CustomerStats {
  total: number
  active: number
  creditExposure: number
}

/**
 * Header KPIs for the customers page — parallel aggregate queries,
 * no row fetching. Credit exposure = sum of credit limits of active customers.
 */
export async function getCustomerStats(): Promise<CustomerStats> {
  const [total, active, creditAgg] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { is_active: true } }),
    prisma.customer.aggregate({
      where: { is_active: true },
      _sum: { credit_limit: true },
    }),
  ])

  return {
    total,
    active,
    creditExposure: creditAgg._sum.credit_limit
      ? Number(creditAgg._sum.credit_limit)
      : 0,
  }
}
