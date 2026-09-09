import { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
  FilterItem,
} from "@/components/shared/data-table/types"
import { prisma } from "@/lib/db"
import type {
  CreateProductInput,
  ProductDetail,
  ProductListItem,
  SetProductActiveInput,
  UpdateProductInput,
} from "../types/product-schema"

const BLOCKING_PURCHASE_ORDER_STATUSES = ["Open", "PO Check"]

const productListQuery = {
  select: {
    id: true,
    product_code: true,
    description: true,
    customer_id: true,
    units_per_shipper: true,
    uom: true,
    is_active: true,
    updated_at: true,
    customer: {
      select: {
        customer_code: true,
        legal_name: true,
        trading_name: true,
      },
    },
    boms: {
      where: { status: "ACTIVE" },
      orderBy: { revision: "desc" },
      take: 1,
      select: {
        id: true,
        revision: true,
        _count: { select: { lines: true } },
      },
    },
  },
} satisfies Prisma.productsDefaultArgs

type ProductListRecord = Prisma.productsGetPayload<typeof productListQuery>

const productDetailQuery = {
  include: {
    customer: {
      select: {
        customer_code: true,
        legal_name: true,
        trading_name: true,
      },
    },
    boms: {
      orderBy: { revision: "desc" },
      select: {
        id: true,
        revision: true,
        status: true,
        effective_from: true,
        effective_to: true,
        updated_at: true,
        _count: { select: { lines: true } },
      },
    },
    _count: {
      select: {
        purchase_orders: {
          where: { current_status: { in: BLOCKING_PURCHASE_ORDER_STATUSES } },
        },
      },
    },
  },
} satisfies Prisma.productsDefaultArgs

type ProductDetailRecord = Prisma.productsGetPayload<typeof productDetailQuery>

const SORTABLE_COLUMNS = new Set([
  "product_code",
  "description",
  "customer_name",
  "units_per_shipper",
  "uom",
  "is_active",
  "bom_state",
  "active_bom_revision",
  "component_count",
  "updated_at",
])

function customerName(
  customer: ProductListRecord["customer"] | ProductDetailRecord["customer"]
): string | null {
  return customer?.trading_name ?? customer?.legal_name ?? null
}

function mapProductListItem(product: ProductListRecord): ProductListItem {
  const activeBom = product.boms[0] ?? null
  return {
    id: product.id,
    product_code: product.product_code,
    description: product.description,
    customer_id: product.customer_id,
    customer_code: product.customer?.customer_code ?? null,
    customer_name: customerName(product.customer),
    units_per_shipper: product.units_per_shipper,
    uom: product.uom,
    is_active: product.is_active,
    bom_state: activeBom ? "ACTIVE" : "MISSING",
    active_bom_id: activeBom?.id ?? null,
    active_bom_revision: activeBom?.revision ?? null,
    component_count: activeBom?._count.lines ?? 0,
    updated_at: product.updated_at.toISOString(),
  }
}

function mapProductDetail(product: ProductDetailRecord): ProductDetail {
  const activeBom = product.boms.find((bom) => bom.status === "ACTIVE") ?? null
  return {
    id: product.id,
    product_code: product.product_code,
    description: product.description,
    customer_id: product.customer_id,
    customer_code: product.customer?.customer_code ?? null,
    customer_name: customerName(product.customer),
    units_per_shipper: product.units_per_shipper,
    uom: product.uom,
    is_active: product.is_active,
    bom_state: activeBom ? "ACTIVE" : "MISSING",
    active_bom_id: activeBom?.id ?? null,
    active_bom_revision: activeBom?.revision ?? null,
    component_count: activeBom?._count.lines ?? 0,
    updated_at: product.updated_at.toISOString(),
    category: product.category,
    daily_run_rate: product.daily_run_rate === null ? null : Number(product.daily_run_rate),
    hourly_run_rate: product.hourly_run_rate === null ? null : Number(product.hourly_run_rate),
    mins_per_shipper: product.mins_per_shipper === null ? null : Number(product.mins_per_shipper),
    price_per_shipper: product.price_per_shipper === null ? null : Number(product.price_per_shipper),
    created_at: product.created_at.toISOString(),
    active_bom_count: product.boms.filter((bom) => bom.status === "ACTIVE").length,
    draft_bom_count: product.boms.filter((bom) => bom.status === "DRAFT").length,
    open_purchase_order_count: product._count.purchase_orders,
    bom_revisions: product.boms.map((bom) => ({
      id: bom.id,
      revision: bom.revision,
      status: bom.status,
      component_count: bom._count.lines,
      effective_from: bom.effective_from?.toISOString().slice(0, 10) ?? null,
      effective_to: bom.effective_to?.toISOString().slice(0, 10) ?? null,
      updated_at: bom.updated_at.toISOString(),
    })),
  }
}

export class ProductWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProductWorkflowError"
  }
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeProductCode(value: string): string {
  return collapseWhitespace(value).toUpperCase()
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

async function assertAssignableCustomer(
  transaction: Prisma.TransactionClient,
  customerId: string | null
): Promise<void> {
  if (!customerId) return
  const customer = await transaction.customer.findUnique({
    where: { id: customerId },
    select: { is_active: true },
  })
  if (!customer) throw new ProductWorkflowError("The selected Customer no longer exists.")
  if (!customer.is_active) {
    throw new ProductWorkflowError("Inactive Customers cannot be assigned to a Product.")
  }
}

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
  source: number | null,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  if (operator === "isEmpty") return source === null
  if (operator === "isNotEmpty") return source !== null
  if (source === null) return false
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
  if (filter.operator === "notContains" && Array.isArray(filter.value)) {
    return !filter.value.map(String).includes(source)
  }
  return matchesText(source, filter.operator, filter.value)
}

function matchesDate(
  source: string,
  operator: FilterItem["operator"],
  value: unknown
): boolean {
  const sourceTime = new Date(source).getTime()
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

function matchesFilter(product: ProductListItem, filter: FilterItem): boolean {
  switch (filter.id) {
    case "product_code": return matchesText(product.product_code, filter.operator, filter.value)
    case "description": return matchesText(product.description, filter.operator, filter.value)
    case "customer_name": return matchesText(product.customer_name, filter.operator, filter.value)
    case "units_per_shipper": return matchesNumber(product.units_per_shipper, filter.operator, filter.value)
    case "uom": return matchesText(product.uom, filter.operator, filter.value)
    case "is_active": return matchesFacet(String(product.is_active), filter)
    case "bom_state": return matchesFacet(product.bom_state, filter)
    case "active_bom_revision": return matchesNumber(product.active_bom_revision, filter.operator, filter.value)
    case "component_count": return matchesNumber(product.component_count, filter.operator, filter.value)
    case "updated_at": return matchesDate(product.updated_at, filter.operator, filter.value)
    default: return true
  }
}

function applyFilters(
  products: ProductListItem[],
  params: DataTableRequest
): ProductListItem[] {
  const search = params.search?.trim().toLocaleLowerCase()
  return products.filter((product) => {
    const matchesSearch = !search || [
      product.product_code,
      product.description,
      product.customer_code,
      product.customer_name,
    ].some((value) => value?.toLocaleLowerCase().includes(search))

    if (!matchesSearch || params.filters.length === 0) return matchesSearch
    const results = params.filters.map((filter) => matchesFilter(product, filter))
    return params.joinOperator === "or" ? results.some(Boolean) : results.every(Boolean)
  })
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

function applySorting(
  products: ProductListItem[],
  params: DataTableRequest
): ProductListItem[] {
  const sorts = params.sorts.filter((sort) => SORTABLE_COLUMNS.has(sort.id))
  const effectiveSorts = sorts.length > 0 ? sorts : [{ id: "product_code", desc: false }]
  return [...products].sort((left, right) => {
    for (const sort of effectiveSorts) {
      const result = compareValues(
        left[sort.id as keyof ProductListItem],
        right[sort.id as keyof ProductListItem]
      )
      if (result !== 0) return sort.desc ? -result : result
    }
    return 0
  })
}

export async function getProductsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<ProductListItem>> {
  const records = await prisma.products.findMany(productListQuery)
  const filtered = applyFilters(records.map(mapProductListItem), params)
  const sorted = applySorting(filtered, params)
  const start = (params.page - 1) * params.pageSize
  return {
    data: sorted.slice(start, start + params.pageSize),
    pageCount: Math.max(1, Math.ceil(filtered.length / params.pageSize)),
    totalCount: filtered.length,
  }
}

export interface ProductStats {
  total: number
  active: number
  inactive: number
  withActiveBom: number
  missingActiveBom: number
}

export async function getProductStats(): Promise<ProductStats> {
  const [total, active, withActiveBom, missingActiveBom] = await Promise.all([
    prisma.products.count(),
    prisma.products.count({ where: { is_active: true } }),
    prisma.products.count({
      where: { is_active: true, boms: { some: { status: "ACTIVE" } } },
    }),
    prisma.products.count({
      where: { is_active: true, boms: { none: { status: "ACTIVE" } } },
    }),
  ])
  return {
    total,
    active,
    inactive: total - active,
    withActiveBom,
    missingActiveBom,
  }
}

export async function getProductById(id: string): Promise<ProductDetail | null> {
  const product = await prisma.products.findUnique({
    where: { id },
    ...productDetailQuery,
  })
  return product ? mapProductDetail(product) : null
}

export async function getCustomerActiveSkus() {
  const customers = await prisma.customer.findMany({
    where: {
      is_active: true,
      products: { some: { is_active: true } },
    },
    select: {
      id: true,
      trading_name: true,
      legal_name: true,
      _count: {
        select: { products: { where: { is_active: true } } },
      },
    },
    orderBy: { products: { _count: "desc" } },
  })

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.trading_name || customer.legal_name,
    activeSkus: customer._count.products,
  }))
}

export interface ProductCustomerOption {
  id: string
  code: string
  name: string
  isActive: boolean
}

export async function getProductCustomerOptions(): Promise<ProductCustomerOption[]> {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customer_code: true,
      legal_name: true,
      trading_name: true,
      is_active: true,
    },
    orderBy: [{ is_active: "desc" }, { customer_code: "asc" }],
  })
  return customers.map((customer) => ({
    id: customer.id,
    code: customer.customer_code,
    name: customer.trading_name || customer.legal_name,
    isActive: customer.is_active,
  }))
}

export async function createProduct(
  input: CreateProductInput
): Promise<{ productId: string; bomId: string }> {
  const productCode = collapseWhitespace(input.productCode)

  try {
    return await prisma.$transaction(async (transaction) => {
      await assertAssignableCustomer(transaction, input.customerId)
      const product = await transaction.products.create({
        data: {
          product_code: productCode,
          description: input.description,
          customer_id: input.customerId,
          units_per_shipper: input.unitsPerShipper,
          uom: input.uom,
          category: input.category,
          daily_run_rate: input.dailyRunRate,
          hourly_run_rate: input.hourlyRunRate,
          mins_per_shipper: input.minsPerShipper,
          price_per_shipper: input.pricePerShipper,
          is_active: true,
          boms: {
            create: { revision: 1, status: "DRAFT" },
          },
        },
        select: {
          id: true,
          boms: { select: { id: true }, take: 1 },
        },
      })
      return { productId: product.id, bomId: product.boms[0].id }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new ProductWorkflowError(`Product code ${productCode} already exists.`)
    }
    throw error
  }
}

export async function updateProduct(
  input: UpdateProductInput
): Promise<{ productId: string }> {
  try {
    return await prisma.$transaction(async (transaction) => {
      await assertAssignableCustomer(transaction, input.customerId)
      const product = await transaction.products.update({
        where: { id: input.productId },
        data: {
          description: input.description,
          customer_id: input.customerId,
          units_per_shipper: input.unitsPerShipper,
          uom: input.uom,
          category: input.category,
          daily_run_rate: input.dailyRunRate,
          hourly_run_rate: input.hourlyRunRate,
          mins_per_shipper: input.minsPerShipper,
          price_per_shipper: input.pricePerShipper,
          updated_at: new Date(),
        },
        select: { id: true },
      })
      return { productId: product.id }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      throw new ProductWorkflowError("This Product no longer exists.")
    }
    throw error
  }
}

export async function setProductActive(
  input: SetProductActiveInput
): Promise<{ productId: string; archivedBomCount: number }> {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.products.findUnique({
      where: { id: input.productId },
      select: { id: true, is_active: true },
    })
    if (!product) throw new ProductWorkflowError("This Product no longer exists.")
    if (product.is_active === input.isActive) {
      return { productId: product.id, archivedBomCount: 0 }
    }

    let archivedBomCount = 0
    if (!input.isActive) {
      const openPurchaseOrders = await transaction.purchase_orders.count({
        where: {
          product_id: input.productId,
          current_status: { in: BLOCKING_PURCHASE_ORDER_STATUSES },
        },
      })
      if (openPurchaseOrders > 0) {
        throw new ProductWorkflowError(
          `This Product has ${openPurchaseOrders} open or pending purchase ${openPurchaseOrders === 1 ? "order" : "orders"} and cannot be deactivated.`
        )
      }

      const now = new Date()
      const [activeBoms, draftBoms] = await Promise.all([
        transaction.bom.updateMany({
          where: { product_id: input.productId, status: "ACTIVE" },
          data: { status: "ARCHIVED", effective_to: now, updated_at: now },
        }),
        transaction.bom.updateMany({
          where: { product_id: input.productId, status: "DRAFT" },
          data: { status: "ARCHIVED", updated_at: now },
        }),
      ])
      archivedBomCount = activeBoms.count + draftBoms.count
    }

    await transaction.products.update({
      where: { id: input.productId },
      data: { is_active: input.isActive, updated_at: new Date() },
    })
    return { productId: product.id, archivedBomCount }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}
