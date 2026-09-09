// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
  FilterItem,
} from "@/components/shared/data-table/types"
import type {
  AddBomLineInput,
  ActivateBomInput,
  BomDetail,
  BomHealth,
  BomLineItem,
  BomListItem,
  BomPartOption,
  CreateBomDraftInput,
  RemoveBomLineInput,
  UpdateBomLineInput,
} from "../types/bom-schema"

// ───────────────── BLOCK 2: Query Shape and Types ─────────────────────────────
const bomQuery = {
  include: {
    product: {
      select: {
        id: true,
        product_code: true,
        description: true,
        is_active: true,
        customer: {
          select: {
            legal_name: true,
            trading_name: true,
          },
        },
      },
    },
    lines: {
      include: {
        part: {
          select: {
            id: true,
            part_code: true,
            description: true,
            part_type: true,
            is_active: true,
          },
        },
      },
      orderBy: [{ position: "asc" }, { part: { part_code: "asc" } }],
    },
  },
} satisfies Prisma.BomDefaultArgs

type BomRecord = Prisma.BomGetPayload<typeof bomQuery>

interface HealthAssessment {
  health: BomHealth
  issueCount: number
  issues: string[]
  duplicatePartIds: Set<string>
}

export class BomWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BomWorkflowError"
  }
}

const SORTABLE_COLUMNS = new Set([
  "product_code",
  "product_description",
  "customer_name",
  "revision",
  "status",
  "health",
  "component_count",
  "issue_count",
  "updated_at",
])

// ───────────────── BLOCK 3: Health and Mapping ────────────────────────────────
function assessHealth(bom: BomRecord): HealthAssessment {
  const partCounts = new Map<string, number>()
  let invalidQuantityCount = 0
  let inactivePartCount = 0
  let missingUomCount = 0

  for (const line of bom.lines) {
    partCounts.set(line.part_id, (partCounts.get(line.part_id) ?? 0) + 1)
    if (line.quantity === null || Number(line.quantity) <= 0) {
      invalidQuantityCount += 1
    }
    if (!line.part.is_active) inactivePartCount += 1
    if (!line.uom?.trim()) missingUomCount += 1
  }

  const duplicatePartIds = new Set(
    [...partCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([partId]) => partId)
  )
  const issues: string[] = []

  if (bom.lines.length === 0) issues.push("BOM has no component lines")
  if (invalidQuantityCount > 0) {
    issues.push(
      `${invalidQuantityCount} ${invalidQuantityCount === 1 ? "quantity needs" : "quantities need"} attention`
    )
  }
  if (inactivePartCount > 0) {
    issues.push(
      `${inactivePartCount} inactive ${inactivePartCount === 1 ? "Part is" : "Parts are"} used`
    )
  }
  if (missingUomCount > 0) {
    issues.push(
      `${missingUomCount} ${missingUomCount === 1 ? "line is" : "lines are"} missing a unit of measure`
    )
  }
  if (duplicatePartIds.size > 0) {
    issues.push(
      `${duplicatePartIds.size} duplicate ${duplicatePartIds.size === 1 ? "Part group" : "Part groups"}`
    )
  }

  const issueCount =
    (bom.lines.length === 0 ? 1 : 0) +
    invalidQuantityCount +
    inactivePartCount +
    missingUomCount +
    duplicatePartIds.size

  return {
    health: issueCount === 0 ? "COMPLETE" : "ATTENTION",
    issueCount,
    issues,
    duplicatePartIds,
  }
}

function mapBomListItem(bom: BomRecord): BomListItem {
  const assessment = assessHealth(bom)
  return {
    id: bom.id,
    product_id: bom.product_id,
    product_code: bom.product.product_code,
    product_description: bom.product.description,
    customer_name:
      bom.product.customer?.trading_name ??
      bom.product.customer?.legal_name ??
      null,
    revision: bom.revision,
    status: bom.status,
    health: assessment.health,
    component_count: bom.lines.length,
    unique_part_count: new Set(bom.lines.map((line) => line.part_id)).size,
    issue_count: assessment.issueCount,
    updated_at: bom.updated_at.toISOString(),
  }
}

function mapBomLine(
  line: BomRecord["lines"][number],
  duplicatePartIds: Set<string>
): BomLineItem {
  const issues: string[] = []
  if (line.quantity === null) issues.push("Missing quantity")
  else if (Number(line.quantity) <= 0) issues.push("Quantity must be greater than zero")
  if (!line.part.is_active) issues.push("Part is inactive")
  if (!line.uom?.trim()) issues.push("Unit of measure is required")
  if (duplicatePartIds.has(line.part_id)) issues.push("Part appears more than once")

  return {
    id: line.id,
    part_id: line.part.id,
    part_code: line.part.part_code,
    description: line.part.description,
    part_type: line.part.part_type,
    quantity: line.quantity === null ? null : Number(line.quantity),
    uom: line.uom,
    is_active: line.part.is_active,
    position: line.position,
    issues,
  }
}

function mapBomDetail(bom: BomRecord): BomDetail {
  const listItem = mapBomListItem(bom)
  const assessment = assessHealth(bom)
  return {
    ...listItem,
    quantity_basis: bom.quantity_basis,
    effective_from: bom.effective_from?.toISOString().slice(0, 10) ?? null,
    effective_to: bom.effective_to?.toISOString().slice(0, 10) ?? null,
    created_at: bom.created_at.toISOString(),
    health_issues: assessment.issues,
    lines: bom.lines.map((line) => mapBomLine(line, assessment.duplicatePartIds)),
  }
}

// ───────────────── BLOCK 4: In-Memory Table Operations ───────────────────────
// The current dataset is still small enough to calculate health after loading
// each BOM's lines. Move this aggregation into SQL before the catalog grows
// beyond the low thousands of BOMs.
function matchesText(
  source: string | null,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  const text = source?.toLocaleLowerCase() ?? ""
  const term = value == null ? "" : String(value).toLocaleLowerCase()
  switch (operator) {
    case "iLike":
    case "contains":
      return text.includes(term)
    case "notILike":
    case "notContains":
      return !text.includes(term)
    case "equals":
      return text === term
    case "notEquals":
      return text !== term
    case "startsWith":
      return text.startsWith(term)
    case "endsWith":
      return text.endsWith(term)
    case "isEmpty":
      return text.length === 0
    case "isNotEmpty":
      return text.length > 0
    default:
      return true
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

function matchesFacet(source: string, operator: FilterItem["operator"], value: unknown) {
  if (operator === "contains" && Array.isArray(value)) {
    return value.map(String).includes(source)
  }
  return matchesText(source, operator, value)
}

function matchesDate(
  source: string,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  const sourceDate = new Date(source)
  const sourceTime = sourceDate.getTime()
  const inputTime = Number(value)
  const dayStart = (time: number) => {
    const date = new Date(time)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }
  const dayEnd = (time: number) => {
    const date = new Date(time)
    date.setHours(23, 59, 59, 999)
    return date.getTime()
  }

  switch (operator) {
    case "equals": return sourceTime >= dayStart(inputTime) && sourceTime <= dayEnd(inputTime)
    case "notEquals": return sourceTime < dayStart(inputTime) || sourceTime > dayEnd(inputTime)
    case "gt": return sourceTime > inputTime
    case "gte": return sourceTime >= inputTime
    case "lt": return sourceTime < inputTime
    case "lte": return sourceTime <= inputTime
    case "isBetween":
      return Array.isArray(value) && value.length === 2
        ? sourceTime >= dayStart(Number(value[0])) && sourceTime <= dayEnd(Number(value[1]))
        : true
    default: return true
  }
}

function matchesFilter(bom: BomListItem, filter: FilterItem): boolean {
  switch (filter.id) {
    case "product_code": return matchesText(bom.product_code, filter.operator, filter.value)
    case "product_description": return matchesText(bom.product_description, filter.operator, filter.value)
    case "customer_name": return matchesText(bom.customer_name, filter.operator, filter.value)
    case "status": return matchesFacet(bom.status, filter.operator, filter.value)
    case "health": return matchesFacet(bom.health, filter.operator, filter.value)
    case "revision": return matchesNumber(bom.revision, filter.operator, filter.value)
    case "component_count": return matchesNumber(bom.component_count, filter.operator, filter.value)
    case "issue_count": return matchesNumber(bom.issue_count, filter.operator, filter.value)
    case "updated_at": return matchesDate(bom.updated_at, filter.operator, filter.value)
    default: return true
  }
}

function applyFilters(items: BomListItem[], params: DataTableRequest): BomListItem[] {
  const search = params.search?.trim().toLocaleLowerCase()
  return items.filter((bom) => {
    const matchesSearch = !search || [
      bom.product_code,
      bom.product_description,
      bom.customer_name,
      bom.status,
      bom.health,
    ].some((value) => value?.toLocaleLowerCase().includes(search))

    if (!matchesSearch || params.filters.length === 0) return matchesSearch
    const results = params.filters.map((filter) => matchesFilter(bom, filter))
    return params.joinOperator === "or" ? results.some(Boolean) : results.every(Boolean)
  })
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function applySorting(items: BomListItem[], params: DataTableRequest): BomListItem[] {
  const sorts = params.sorts.filter((sort) => SORTABLE_COLUMNS.has(sort.id))
  const effectiveSorts = sorts.length > 0 ? sorts : [{ id: "product_code", desc: false }]
  return [...items].sort((left, right) => {
    for (const sort of effectiveSorts) {
      const result = compareValues(
        left[sort.id as keyof BomListItem],
        right[sort.id as keyof BomListItem]
      )
      if (result !== 0) return sort.desc ? -result : result
    }
    return 0
  })
}

// ───────────────── BLOCK 5: Service Functions ────────────────────────────────
async function getAllBomRecords(): Promise<BomRecord[]> {
  return prisma.bom.findMany(bomQuery)
}

export async function getBomsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<BomListItem>> {
  const records = await getAllBomRecords()
  const filtered = applyFilters(records.map(mapBomListItem), params)
  const sorted = applySorting(filtered, params)
  const start = (params.page - 1) * params.pageSize

  return {
    data: sorted.slice(start, start + params.pageSize),
    pageCount: Math.max(1, Math.ceil(filtered.length / params.pageSize)),
    totalCount: filtered.length,
  }
}

export async function getBomById(id: string): Promise<BomDetail | null> {
  const bom = await prisma.bom.findUnique({
    where: { id },
    ...bomQuery,
  })
  return bom ? mapBomDetail(bom) : null
}

export interface BomStats {
  total: number
  active: number
  complete: number
  attention: number
  productsMissingBom: number
}

export async function getBomStats(): Promise<BomStats> {
  const [records, productsMissingBom] = await Promise.all([
    getAllBomRecords(),
    prisma.products.count({
      where: { is_active: true, boms: { none: { status: "ACTIVE" } } },
    }),
  ])
  const items = records.map(mapBomListItem)
  const activeItems = items.filter((item) => item.status === "ACTIVE")
  return {
    total: items.length,
    active: activeItems.length,
    complete: activeItems.filter((item) => item.health === "COMPLETE").length,
    attention: activeItems.filter((item) => item.health === "ATTENTION").length,
    productsMissingBom,
  }
}

// ───────────────── BLOCK 6: Draft Mutation Services ─────────────────
interface DraftCreationResult {
  bomId: string
  productId: string
  created: boolean
}

interface BomMutationServiceResult {
  bomId: string
  productId: string
  lineId?: string
}

function currentDateOnly(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
}

async function requireDraftBom(tx: Prisma.TransactionClient, bomId: string) {
  const bom = await tx.bom.findUnique({
    where: { id: bomId },
    select: { id: true, product_id: true, status: true },
  })
  if (!bom) throw new BomWorkflowError("BOM not found.")
  if (bom.status !== "DRAFT") {
    throw new BomWorkflowError("Only draft BOM revisions can be edited.")
  }
  return bom
}

export async function getBomPartOptions(): Promise<BomPartOption[]> {
  return prisma.part.findMany({
    where: { is_active: true },
    orderBy: { part_code: "asc" },
    select: {
      id: true,
      part_code: true,
      description: true,
      part_type: true,
      default_uom: true,
    },
  })
}

export async function createBomDraft(
  input: CreateBomDraftInput
): Promise<DraftCreationResult> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.bom.findUnique({
      where: { id: input.sourceBomId },
      include: {
        product: { select: { is_active: true } },
        lines: { orderBy: [{ position: "asc" }, { created_at: "asc" }] },
      },
    })
    if (!source) throw new BomWorkflowError("The source BOM was not found.")
    if (!source.product.is_active) {
      throw new BomWorkflowError("A draft cannot be created for an inactive Product.")
    }
    if (source.status === "DRAFT") {
      return { bomId: source.id, productId: source.product_id, created: false }
    }

    const existingDraft = await tx.bom.findFirst({
      where: { product_id: source.product_id, status: "DRAFT" },
      orderBy: { revision: "desc" },
      select: { id: true, product_id: true },
    })
    if (existingDraft) {
      return {
        bomId: existingDraft.id,
        productId: existingDraft.product_id,
        created: false,
      }
    }

    const latestRevision = await tx.bom.aggregate({
      where: { product_id: source.product_id },
      _max: { revision: true },
    })
    const now = new Date()
    const draft = await tx.bom.create({
      data: {
        product_id: source.product_id,
        revision: (latestRevision._max.revision ?? 0) + 1,
        status: "DRAFT",
        quantity_basis: source.quantity_basis,
        effective_from: null,
        effective_to: null,
        created_at: now,
        updated_at: now,
        lines: {
          create: source.lines.map((line, index) => ({
            part_id: line.part_id,
            quantity: line.quantity,
            uom: line.uom,
            position: line.position ?? index + 1,
            created_at: now,
            updated_at: now,
          })),
        },
      },
      select: { id: true, product_id: true },
    })
    return { bomId: draft.id, productId: draft.product_id, created: true }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function addBomLine(
  input: AddBomLineInput
): Promise<BomMutationServiceResult> {
  return prisma.$transaction(async (tx) => {
    const bom = await requireDraftBom(tx, input.bomId)
    const part = await tx.part.findUnique({
      where: { id: input.partId },
      select: { id: true, is_active: true },
    })
    if (!part) throw new BomWorkflowError("Part not found.")
    if (!part.is_active) throw new BomWorkflowError("Inactive Parts cannot be added to a BOM.")

    const duplicate = await tx.bomLine.findFirst({
      where: { bom_id: bom.id, part_id: part.id },
      select: { id: true },
    })
    if (duplicate) throw new BomWorkflowError("This Part is already present in the draft BOM.")

    const lastPosition = await tx.bomLine.aggregate({
      where: { bom_id: bom.id },
      _max: { position: true },
    })
    const now = new Date()
    const line = await tx.bomLine.create({
      data: {
        bom_id: bom.id,
        part_id: part.id,
        quantity: new Prisma.Decimal(input.quantity),
        uom: input.uom,
        position: (lastPosition._max.position ?? 0) + 1,
        created_at: now,
        updated_at: now,
      },
      select: { id: true },
    })
    await tx.bom.update({
      where: { id: bom.id },
      data: { updated_at: now },
    })
    return { bomId: bom.id, productId: bom.product_id, lineId: line.id }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function updateBomLine(
  input: UpdateBomLineInput
): Promise<BomMutationServiceResult> {
  return prisma.$transaction(async (tx) => {
    const bom = await requireDraftBom(tx, input.bomId)
    const line = await tx.bomLine.findFirst({
      where: { id: input.lineId, bom_id: bom.id },
      select: { id: true },
    })
    if (!line) throw new BomWorkflowError("BOM line not found in this draft.")

    const now = new Date()
    await tx.bomLine.update({
      where: { id: line.id },
      data: {
        quantity: new Prisma.Decimal(input.quantity),
        uom: input.uom,
        updated_at: now,
      },
    })
    await tx.bom.update({
      where: { id: bom.id },
      data: { updated_at: now },
    })
    return { bomId: bom.id, productId: bom.product_id, lineId: line.id }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function removeBomLine(
  input: RemoveBomLineInput
): Promise<BomMutationServiceResult> {
  return prisma.$transaction(async (tx) => {
    const bom = await requireDraftBom(tx, input.bomId)
    const line = await tx.bomLine.findFirst({
      where: { id: input.lineId, bom_id: bom.id },
      select: { id: true },
    })
    if (!line) throw new BomWorkflowError("BOM line not found in this draft.")

    await tx.bomLine.delete({ where: { id: line.id } })
    await tx.bom.update({
      where: { id: bom.id },
      data: { updated_at: new Date() },
    })
    return { bomId: bom.id, productId: bom.product_id, lineId: line.id }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

export async function activateBom(
  input: ActivateBomInput
): Promise<BomMutationServiceResult> {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.bom.findUnique({
      where: { id: input.bomId },
      include: {
        product: { select: { is_active: true } },
        lines: {
          include: {
            part: { select: { part_code: true, is_active: true } },
          },
        },
      },
    })
    if (!draft) throw new BomWorkflowError("BOM not found.")
    if (draft.status !== "DRAFT") {
      throw new BomWorkflowError("Only a draft BOM can be activated.")
    }
    if (!draft.product.is_active) {
      throw new BomWorkflowError("A BOM for an inactive Product cannot be activated.")
    }

    const validationIssues: string[] = []
    if (draft.lines.length === 0) validationIssues.push("add at least one component")
    const partIds = new Set<string>()
    for (const line of draft.lines) {
      if (partIds.has(line.part_id)) {
        validationIssues.push(`remove the duplicate Part ${line.part.part_code}`)
      }
      partIds.add(line.part_id)
      if (line.quantity === null || Number(line.quantity) <= 0) {
        validationIssues.push(`enter a positive quantity for ${line.part.part_code}`)
      }
      if (!line.uom?.trim()) {
        validationIssues.push(`enter a unit of measure for ${line.part.part_code}`)
      }
      if (!line.part.is_active) {
        validationIssues.push(`replace the inactive Part ${line.part.part_code}`)
      }
    }
    if (validationIssues.length > 0) {
      throw new BomWorkflowError(`Cannot activate this BOM: ${validationIssues.join("; ")}.`)
    }

    const now = new Date()
    const effectiveDate = currentDateOnly()
    await tx.bom.updateMany({
      where: {
        product_id: draft.product_id,
        status: "ACTIVE",
        id: { not: draft.id },
      },
      data: {
        status: "ARCHIVED",
        effective_to: effectiveDate,
        updated_at: now,
      },
    })
    await tx.bom.update({
      where: { id: draft.id },
      data: {
        status: "ACTIVE",
        effective_from: draft.effective_from ?? effectiveDate,
        effective_to: null,
        updated_at: now,
      },
    })
    return { bomId: draft.id, productId: draft.product_id }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}
