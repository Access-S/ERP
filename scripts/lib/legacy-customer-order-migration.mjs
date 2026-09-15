import { Prisma } from "@prisma/client"

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function resolveCustomer(order, customers) {
  const directCustomerId = order.customer_id
  const productCustomerId = order.products?.customer_id ?? null
  if (directCustomerId && productCustomerId && directCustomerId !== productCustomerId) {
    return { customer: null, method: "CONFLICT", reason: "Order and Product customers differ" }
  }

  const linkedCustomerId = directCustomerId ?? productCustomerId
  if (linkedCustomerId) {
    const customer = customers.find((candidate) => candidate.id === linkedCustomerId) ?? null
    return customer
      ? { customer, method: directCustomerId ? "DIRECT" : "PRODUCT", reason: null }
      : { customer: null, method: "BROKEN_LINK", reason: "Linked Customer does not exist" }
  }

  const customerName = normalizeName(order.customer_name)
  const exactMatches = customers.filter((customer) =>
    [customer.legal_name, customer.trading_name]
      .filter(Boolean)
      .some((name) => normalizeName(name) === customerName)
  )
  if (exactMatches.length === 1) {
    return { customer: exactMatches[0], method: "EXACT_NAME", reason: null }
  }
  return {
    customer: null,
    method: exactMatches.length > 1 ? "AMBIGUOUS_NAME" : "MANUAL",
    reason: exactMatches.length > 1
      ? "Customer name matches more than one Customer"
      : "No Customer relationship or exact name match is available",
  }
}

function mapStatuses(legacyStatus) {
  if (legacyStatus === "PO Canceled") {
    return { orderStatus: "CANCELLED", releaseStatus: "CANCELLED" }
  }
  if (legacyStatus === "Despatched/ Completed") {
    return { orderStatus: "CLOSED", releaseStatus: "COMPLETED" }
  }
  return { orderStatus: "PO_CHECK", releaseStatus: "PO_CHECK" }
}

function positiveOrNull(value) {
  const decimal = new Prisma.Decimal(value)
  return decimal.greaterThan(0) ? decimal : null
}

function historicalPrice(order) {
  const shippers = positiveOrNull(order.ordered_qty_shippers)
  if (shippers) {
    const systemAmount = new Prisma.Decimal(order.system_amount)
    if (systemAmount.greaterThan(0)) return systemAmount.dividedBy(shippers).toDecimalPlaces(4)
  }
  return order.products?.price_per_shipper ?? null
}

function variance(order) {
  const customerValue = new Prisma.Decimal(order.customer_amount)
  const expectedValue = new Prisma.Decimal(order.system_amount)
  const amount = customerValue.minus(expectedValue).absoluteValue().toDecimalPlaces(2)
  const percentage = expectedValue.greaterThan(0)
    ? amount.dividedBy(expectedValue).times(100).toDecimalPlaces(4)
    : null
  return { amount, percentage }
}

export async function loadLegacyCustomerOrderMigrationPlan(prisma) {
  const [orders, customers, existingTargets] = await Promise.all([
    prisma.purchase_orders.findMany({
      include: {
        products: {
          include: {
            boms: {
              where: { status: "ACTIVE" },
              orderBy: { revision: "desc" },
              take: 1,
            },
          },
        },
        migrated_release_line: {
          select: { id: true, releaseId: true },
        },
      },
      orderBy: [{ po_number: "asc" }, { id: "asc" }],
    }),
    prisma.customer.findMany(),
    prisma.customerPurchaseOrder.findMany({
      select: { id: true, customerId: true, customerPoNumber: true },
    }),
  ])

  const targetKeys = new Map(
    existingTargets.map((target) => [`${target.customerId}\u0000${target.customerPoNumber}`, target.id])
  )
  const rows = orders.map((order) => {
    const resolution = resolveCustomer(order, customers)
    const product = order.products
    const statuses = mapStatuses(order.current_status)
    const errors = []
    if (!resolution.customer) errors.push(resolution.reason)
    if (!product) errors.push("Linked Product does not exist")
    if (resolution.customer) {
      const currency = resolution.customer.default_currency.trim()
      if (!/^[A-Za-z]{3}$/.test(currency)) {
        errors.push("Customer currency must contain exactly three letters")
      }
    }
    if (!order.po_number.trim()) errors.push("PO number is blank")
    if (order.po_number.length > 100) errors.push("PO number exceeds 100 characters")
    if (product?.product_code.length > 100) errors.push("Product code exceeds 100 characters")
    if (new Prisma.Decimal(order.customer_amount).isNegative()) {
      errors.push("Customer amount is negative")
    }
    if (new Prisma.Decimal(order.system_amount).isNegative()) {
      errors.push("System amount is negative")
    }
    const orderedPieces = new Prisma.Decimal(order.ordered_qty_pieces)
    const orderedShippers = new Prisma.Decimal(order.ordered_qty_shippers)
    if (!orderedPieces.greaterThan(0) && !orderedShippers.greaterThan(0)) {
      errors.push("Both legacy quantities are zero or negative")
    }
    const targetKey = resolution.customer
      ? `${resolution.customer.id}\u0000${order.po_number}`
      : null
    const conflictingTargetId = targetKey ? targetKeys.get(targetKey) : null
    if (conflictingTargetId && !order.migrated_release_line) {
      errors.push(`A normalized Customer PO already uses this Customer and PO number (${conflictingTargetId})`)
    }

    return {
      order,
      product,
      customer: resolution.customer,
      customerResolutionMethod: resolution.method,
      statuses,
      activeBom: product?.boms[0] ?? null,
      errors: errors.filter(Boolean),
      alreadyMigrated: Boolean(order.migrated_release_line),
      orderedQuantity: orderedPieces.greaterThan(0) ? orderedPieces : orderedShippers,
      orderUom: orderedPieces.greaterThan(0) ? "UNIT" : "SHIPPER",
      calculatedShippers: positiveOrNull(order.ordered_qty_shippers),
      historicalPrice: historicalPrice(order),
      variance: variance(order),
    }
  })

  return {
    rows,
    readyRows: rows.filter((row) => !row.alreadyMigrated && row.errors.length === 0),
    blockedRows: rows.filter((row) => !row.alreadyMigrated && row.errors.length > 0),
    alreadyMigratedRows: rows.filter((row) => row.alreadyMigrated),
  }
}

export function legacyValidationIssues(row) {
  const issues = [{
    code: "LEGACY_MISSING_DELIVERY_DATE",
    message: "Legacy record has no requested delivery date and cannot be released to new planning.",
  }]
  if (row.customerResolutionMethod === "EXACT_NAME") {
    issues.push({
      code: "LEGACY_CUSTOMER_NAME_MAPPING",
      message: "Customer was recovered from one exact normalized Customer-name match.",
    })
  }
  if (!row.product.customer_id) {
    issues.push({
      code: "LEGACY_PRODUCT_CUSTOMER_MISSING",
      message: "The historical Product has no Customer link; the legacy Customer name was retained as evidence.",
    })
  }
  return issues
}
