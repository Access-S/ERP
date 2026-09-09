// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
  FilterItem,
  Option,
} from "@/components/shared/data-table/types"
import type {
  CreatePartInput,
  Part,
  PartDetail,
  SetPartActiveInput,
  UpdatePartInput,
} from "../types/part-schema"

// ───────────────── BLOCK 2: Query Shape ──────────────────────────────────────
const partListQuery = {
  include: {
    bom_lines: {
      select: { bom_id: true },
    },
  },
} satisfies Prisma.PartDefaultArgs

type PartRecord = Prisma.PartGetPayload<typeof partListQuery>

const SORTABLE_COLUMNS = new Set([
  "part_code",
  "description",
  "part_type",
  "default_uom",
  "is_active",
  "bom_count",
  "line_count",
  "updated_at",
])

// ───────────────── BLOCK 3: Mapping ──────────────────────────────────────────
function mapToPart(part: PartRecord): Part {
  return {
    id: part.id,
    part_code: part.part_code,
    description: part.description,
    part_type: part.part_type,
    default_uom: part.default_uom,
    is_active: part.is_active,
    bom_count: new Set(part.bom_lines.map((line) => line.bom_id)).size,
    line_count: part.bom_lines.length,
    updated_at: part.updated_at.toISOString(),
  }
}

export class PartWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PartWorkflowError"
  }
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizePartCode(value: string): string {
  return collapseWhitespace(value).toUpperCase()
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

// ───────────────── BLOCK 4: In-Memory Table Operations ───────────────────────
// Part usage counts are derived from related BOM Lines. The imported catalog is
// small, so filtering the mapped set keeps those counts correct and transparent.
function matchesText(
  source: string | null,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  const text = source?.toLocaleLowerCase() ?? ""
  const term = value == null ? "" : String(value).toLocaleLowerCase()
  switch (operator) {
    case "iLike":
    case "contains": return text.includes(term)
    case "notILike":
    case "notContains": return !text.includes(term)
    case "equals": return text === term
    case "notEquals": return text !== term
    case "startsWith": return text.startsWith(term)
    case "endsWith": return text.endsWith(term)
    case "isEmpty": return text.length === 0
    case "isNotEmpty": return text.length > 0
    default: return true
  }
}

function matchesNumber(
  source: number,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  const number = Number(value)
  switch (operator) {
    case "equals": return source === number
    case "notEquals": return source !== number
    case "gt": return source > number
    case "gte": return source >= number
    case "lt": return source < number
    case "lte": return source <= number
    case "isBetween":
      return Array.isArray(value) && value.length === 2
        ? source >= Number(value[0]) && source <= Number(value[1])
        : true
    default: return true
  }
}

function matchesFacet(source: string, filter: FilterItem): boolean {
  if (filter.operator === "contains" && Array.isArray(filter.value)) {
    return filter.value.map(String).includes(source)
  }
  return matchesText(source, filter.operator, filter.value)
}

function matchesFilter(part: Part, filter: FilterItem): boolean {
  switch (filter.id) {
    case "part_code": return matchesText(part.part_code, filter.operator, filter.value)
    case "description": return matchesText(part.description, filter.operator, filter.value)
    case "part_type": return matchesFacet(part.part_type ?? "", filter)
    case "default_uom": return matchesText(part.default_uom, filter.operator, filter.value)
    case "is_active": return matchesFacet(String(part.is_active), filter)
    case "bom_count": return matchesNumber(part.bom_count, filter.operator, filter.value)
    case "line_count": return matchesNumber(part.line_count, filter.operator, filter.value)
    default: return true
  }
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right)
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function applyFilters(items: Part[], params: DataTableRequest): Part[] {
  const search = params.search?.trim().toLocaleLowerCase()
  return items.filter((part) => {
    const matchesSearch = !search || [part.part_code, part.description, part.part_type]
      .some((value) => value?.toLocaleLowerCase().includes(search))
    if (!matchesSearch || params.filters.length === 0) return matchesSearch
    const matches = params.filters.map((filter) => matchesFilter(part, filter))
    return params.joinOperator === "or" ? matches.some(Boolean) : matches.every(Boolean)
  })
}

function applySorting(items: Part[], params: DataTableRequest): Part[] {
  const sorts = params.sorts.filter((sort) => SORTABLE_COLUMNS.has(sort.id))
  const effectiveSorts = sorts.length > 0 ? sorts : [{ id: "part_code", desc: false }]
  return [...items].sort((left, right) => {
    for (const sort of effectiveSorts) {
      const result = compareValues(
        left[sort.id as keyof Part],
        right[sort.id as keyof Part]
      )
      if (result !== 0) return sort.desc ? -result : result
    }
    return 0
  })
}

// ───────────────── BLOCK 5: Service Functions ────────────────────────────────
export async function getPartsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Part>> {
  const records = await prisma.part.findMany(partListQuery)
  const filtered = applyFilters(records.map(mapToPart), params)
  const sorted = applySorting(filtered, params)
  const start = (params.page - 1) * params.pageSize
  return {
    data: sorted.slice(start, start + params.pageSize),
    pageCount: Math.max(1, Math.ceil(filtered.length / params.pageSize)),
    totalCount: filtered.length,
  }
}

export interface PartStats {
  total: number
  active: number
  used: number
  unused: number
}

export async function getPartStats(): Promise<PartStats> {
  const [total, active, used, unused] = await Promise.all([
    prisma.part.count(),
    prisma.part.count({ where: { is_active: true } }),
    prisma.part.count({ where: { bom_lines: { some: { bom: { status: "ACTIVE" } } } } }),
    prisma.part.count({ where: { bom_lines: { none: { bom: { status: "ACTIVE" } } } } }),
  ])
  return { total, active, used, unused }
}

export interface PartFilterOptions {
  partTypes: Option[]
}

export async function getPartFilterOptions(): Promise<PartFilterOptions> {
  const groups = await prisma.part.groupBy({
    by: ["part_type"],
    where: { part_type: { not: null } },
    _count: { _all: true },
    orderBy: { part_type: "asc" },
  })
  return {
    partTypes: groups.map((group) => ({
      label: group.part_type as string,
      value: group.part_type as string,
      count: group._count._all,
    })),
  }
}

export async function getPartById(id: string): Promise<PartDetail | null> {
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      bom_lines: {
        include: {
          bom: {
            include: {
              product: {
                select: {
                  id: true,
                  product_code: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: [{ bom: { product: { product_code: "asc" } } }],
      },
    },
  })
  if (!part) return null

  return {
    id: part.id,
    part_code: part.part_code,
    normalized_code: part.normalized_code,
    description: part.description,
    part_type: part.part_type,
    default_uom: part.default_uom,
    is_active: part.is_active,
    bom_count: new Set(part.bom_lines.map((line) => line.bom_id)).size,
    line_count: part.bom_lines.length,
    active_bom_count: new Set(
      part.bom_lines
        .filter((line) => line.bom.status === "ACTIVE")
        .map((line) => line.bom_id)
    ).size,
    created_at: part.created_at.toISOString(),
    updated_at: part.updated_at.toISOString(),
    where_used: part.bom_lines.map((line) => ({
      bom_id: line.bom.id,
      product_id: line.bom.product.id,
      product_code: line.bom.product.product_code,
      product_description: line.bom.product.description,
      revision: line.bom.revision,
      bom_status: line.bom.status,
      quantity: line.quantity === null ? null : Number(line.quantity),
      uom: line.uom,
    })),
  }
}

export async function createPart(input: CreatePartInput): Promise<{ partId: string }> {
  const partCode = collapseWhitespace(input.partCode)

  try {
    const part = await prisma.part.create({
      data: {
        part_code: partCode,
        normalized_code: normalizePartCode(partCode),
        description: input.description,
        part_type: input.partType,
        default_uom: input.defaultUom,
        is_active: true,
      },
      select: { id: true },
    })
    return { partId: part.id }
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new PartWorkflowError(`Part code ${partCode} already exists.`)
    }
    throw error
  }
}

export async function updatePart(input: UpdatePartInput): Promise<{ partId: string }> {
  try {
    const part = await prisma.part.update({
      where: { id: input.partId },
      data: {
        description: input.description,
        part_type: input.partType,
        default_uom: input.defaultUom,
        updated_at: new Date(),
      },
      select: { id: true },
    })
    return { partId: part.id }
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      throw new PartWorkflowError("This Part no longer exists.")
    }
    throw error
  }
}

export async function setPartActive(
  input: SetPartActiveInput
): Promise<{ partId: string }> {
  return prisma.$transaction(async (transaction) => {
    const part = await transaction.part.findUnique({
      where: { id: input.partId },
      select: { id: true, is_active: true },
    })
    if (!part) throw new PartWorkflowError("This Part no longer exists.")
    if (part.is_active === input.isActive) return { partId: part.id }

    if (!input.isActive) {
      const activeBomUsage = await transaction.bomLine.count({
        where: {
          part_id: input.partId,
          bom: { status: "ACTIVE" },
        },
      })
      if (activeBomUsage > 0) {
        throw new PartWorkflowError(
          "This Part is used by an active BOM and cannot be deactivated. Revise those BOMs first."
        )
      }
    }

    await transaction.part.update({
      where: { id: input.partId },
      data: {
        is_active: input.isActive,
        updated_at: new Date(),
      },
    })
    return { partId: part.id }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}
