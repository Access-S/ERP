import { Prisma } from "@prisma/client"

export type DecimalInput = Prisma.Decimal | string
export type DateInput = Date | string | null | undefined

export type CustomerOrderValidationIssueCode =
  | "CUSTOMER_INACTIVE"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_CUSTOMER_MISMATCH"
  | "ACTIVE_BOM_REQUIRED"
  | "QUANTITY_INVALID"
  | "QUANTITY_MUST_BE_WHOLE"
  | "UNITS_PER_SHIPPER_INVALID"
  | "APPROVED_PRICE_INVALID"
  | "DELIVERY_DATE_REQUIRED"
  | "CUSTOMER_LINE_VALUE_INVALID"
  | "TOLERANCE_CONFIGURATION_INVALID"
  | "INCOMPLETE_SHIPPER"
  | "LINE_PRICE_VARIANCE"
  | "LINES_REQUIRED"
  | "LINE_VALIDATION_FAILED"
  | "CUSTOMER_TOTAL_INVALID"
  | "STATED_LINE_TOTAL_MISMATCH"
  | "RELEASE_TOTAL_PRICE_VARIANCE"
  | "BLANKET_NOT_ACTIVE"
  | "BLANKET_OUTSIDE_VALIDITY"
  | "BLANKET_BALANCE_INVALID"
  | "BLANKET_BALANCE_EXCEEDED"

export type CustomerOrderValidationIssue = {
  code: CustomerOrderValidationIssueCode
  message: string
}

export type CustomerOrderLineValidationInput = {
  customerActive: boolean
  selectedCustomerId: string
  productActive: boolean
  productCustomerId: string | null
  activeBomId: string | null
  orderedQuantity: DecimalInput | null
  orderUom: "UNIT" | "SHIPPER"
  requestedDeliveryDate: DateInput
  unitsPerShipper: DecimalInput | null
  approvedPricePerShipper: DecimalInput | null
  customerLineValue: DecimalInput | null
  tolerancePercentage: DecimalInput | null
  currencyDecimalPlaces?: number
}

export type CustomerOrderLineValidationResult = {
  status: "VALID" | "PO_CHECK"
  issues: readonly CustomerOrderValidationIssue[]
  calculatedShippers: Prisma.Decimal | null
  expectedLineValue: Prisma.Decimal | null
  varianceAmount: Prisma.Decimal | null
  variancePercentage: Prisma.Decimal | null
}

export type BlanketValidationContext = {
  status: string
  validFrom: DateInput
  validTo: DateInput
  availableValue: DecimalInput | null
}

export type CustomerOrderReleaseValidationInput = {
  orderType: "STANDARD" | "BLANKET"
  customerNetTotal: DecimalInput | null
  lines: readonly CustomerOrderLineValidationResult[]
  lineCustomerValues: readonly (DecimalInput | null)[]
  tolerancePercentage: DecimalInput | null
  currencyDecimalPlaces?: number
  blanket?: BlanketValidationContext
  validationDate?: Date
}

export type CustomerOrderReleaseValidationResult = {
  status: "PO_CHECK" | "READY_FOR_PLANNING"
  issues: readonly CustomerOrderValidationIssue[]
  customerLineTotal: Prisma.Decimal | null
  expectedNetTotal: Prisma.Decimal | null
  varianceAmount: Prisma.Decimal | null
  variancePercentage: Prisma.Decimal | null
}

function decimalOrNull(value: DecimalInput | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null

  try {
    const decimal = new Prisma.Decimal(value)
    return decimal.isFinite() ? decimal : null
  } catch {
    return null
  }
}

function validTolerance(value: DecimalInput | null): Prisma.Decimal | null {
  const tolerance = decimalOrNull(value)
  if (!tolerance || tolerance.isNegative() || tolerance.greaterThan(100)) return null
  return tolerance
}

function validCurrencyDecimalPlaces(value: number | undefined): number {
  if (value === undefined) return 2
  if (!Number.isInteger(value) || value < 0 || value > 4) {
    throw new RangeError("Currency decimal places must be a whole number from 0 to 4.")
  }
  return value
}

function money(value: Prisma.Decimal, decimalPlaces: number): Prisma.Decimal {
  return value.toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_HALF_UP)
}

function absolute(value: Prisma.Decimal): Prisma.Decimal {
  return value.absoluteValue()
}

function variancePercentage(
  variance: Prisma.Decimal,
  expected: Prisma.Decimal
): Prisma.Decimal | null {
  if (expected.isZero()) return null
  return variance.dividedBy(expected).times(100).toDecimalPlaces(4)
}

function dateKey(value: DateInput): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (!match) return null
  const parsed = new Date(`${match[1]}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1]
    ? null
    : match[1]
}

function addIssue(
  issues: CustomerOrderValidationIssue[],
  code: CustomerOrderValidationIssueCode,
  message: string
): void {
  if (!issues.some((issue) => issue.code === code)) issues.push({ code, message })
}

export function validateCustomerOrderLine(
  input: CustomerOrderLineValidationInput
): CustomerOrderLineValidationResult {
  const issues: CustomerOrderValidationIssue[] = []
  const decimalPlaces = validCurrencyDecimalPlaces(input.currencyDecimalPlaces)
  const quantity = decimalOrNull(input.orderedQuantity)
  const unitsPerShipper = decimalOrNull(input.unitsPerShipper)
  const pricePerShipper = decimalOrNull(input.approvedPricePerShipper)
  const customerLineValue = decimalOrNull(input.customerLineValue)
  const tolerance = validTolerance(input.tolerancePercentage)

  if (!input.customerActive) {
    addIssue(issues, "CUSTOMER_INACTIVE", "The selected customer is not active.")
  }
  if (!input.productActive) {
    addIssue(issues, "PRODUCT_INACTIVE", "The selected product is not active.")
  }
  if (!input.productCustomerId || input.productCustomerId !== input.selectedCustomerId) {
    addIssue(
      issues,
      "PRODUCT_CUSTOMER_MISMATCH",
      "The selected product is not assigned to this customer."
    )
  }
  if (!input.activeBomId) {
    addIssue(
      issues,
      "ACTIVE_BOM_REQUIRED",
      "The selected product does not have an active BOM for planning."
    )
  }
  if (!quantity || !quantity.greaterThan(0)) {
    addIssue(issues, "QUANTITY_INVALID", "Order quantity must be greater than zero.")
  } else if (!quantity.isInteger()) {
    addIssue(
      issues,
      "QUANTITY_MUST_BE_WHOLE",
      "Order quantity must be a whole number of units or shippers."
    )
  }
  if (!unitsPerShipper || !unitsPerShipper.greaterThan(0) || !unitsPerShipper.isInteger()) {
    addIssue(
      issues,
      "UNITS_PER_SHIPPER_INVALID",
      "Units per shipper must be a positive whole number."
    )
  }
  if (!pricePerShipper || !pricePerShipper.greaterThan(0)) {
    addIssue(
      issues,
      "APPROVED_PRICE_INVALID",
      "The product requires a positive approved price per shipper."
    )
  }
  if (!dateKey(input.requestedDeliveryDate)) {
    addIssue(issues, "DELIVERY_DATE_REQUIRED", "A requested delivery date is required.")
  }
  if (!customerLineValue || customerLineValue.isNegative()) {
    addIssue(
      issues,
      "CUSTOMER_LINE_VALUE_INVALID",
      "Customer-stated line value must be zero or greater."
    )
  }
  if (!tolerance) {
    addIssue(
      issues,
      "TOLERANCE_CONFIGURATION_INVALID",
      "The configured price tolerance must be between 0% and 100%."
    )
  }

  let calculatedShippers: Prisma.Decimal | null = null
  if (quantity?.greaterThan(0)) {
    if (input.orderUom === "SHIPPER") {
      calculatedShippers = quantity
    } else if (unitsPerShipper?.greaterThan(0)) {
      calculatedShippers = quantity.dividedBy(unitsPerShipper)
    }
  }

  if (calculatedShippers && !calculatedShippers.isInteger()) {
    addIssue(
      issues,
      "INCOMPLETE_SHIPPER",
      "The ordered units do not make a complete number of shippers."
    )
  }

  let expectedLineValue: Prisma.Decimal | null = null
  let lineVariance: Prisma.Decimal | null = null
  let lineVariancePercentage: Prisma.Decimal | null = null

  if (calculatedShippers?.greaterThan(0) && pricePerShipper?.greaterThan(0)) {
    expectedLineValue = money(calculatedShippers.times(pricePerShipper), decimalPlaces)
  }

  if (expectedLineValue && customerLineValue && !customerLineValue.isNegative()) {
    lineVariance = absolute(customerLineValue.minus(expectedLineValue))
    lineVariancePercentage = variancePercentage(lineVariance, expectedLineValue)

    if (tolerance) {
      const allowance = expectedLineValue.times(tolerance).dividedBy(100)
      if (lineVariance.greaterThan(allowance)) {
        addIssue(
          issues,
          "LINE_PRICE_VARIANCE",
          "The customer-stated line value is outside the configured tolerance."
        )
      }
    }
  }

  return {
    status: issues.length === 0 ? "VALID" : "PO_CHECK",
    issues,
    calculatedShippers,
    expectedLineValue,
    varianceAmount: lineVariance,
    variancePercentage: lineVariancePercentage,
  }
}

export function validateCustomerOrderRelease(
  input: CustomerOrderReleaseValidationInput
): CustomerOrderReleaseValidationResult {
  const issues: CustomerOrderValidationIssue[] = []
  const decimalPlaces = validCurrencyDecimalPlaces(input.currencyDecimalPlaces)
  const customerNetTotal = decimalOrNull(input.customerNetTotal)
  const tolerance = validTolerance(input.tolerancePercentage)
  const parsedLineValues = input.lineCustomerValues.map(decimalOrNull)

  if (input.lines.length === 0 || input.lines.length !== input.lineCustomerValues.length) {
    addIssue(issues, "LINES_REQUIRED", "At least one complete order line is required.")
  }
  if (input.lines.some((line) => line.status === "PO_CHECK")) {
    addIssue(
      issues,
      "LINE_VALIDATION_FAILED",
      "One or more lines require correction before planning."
    )
  }
  if (!customerNetTotal || customerNetTotal.isNegative()) {
    addIssue(
      issues,
      "CUSTOMER_TOTAL_INVALID",
      "Customer-stated release total must be zero or greater."
    )
  }
  if (!tolerance) {
    addIssue(
      issues,
      "TOLERANCE_CONFIGURATION_INVALID",
      "The configured price tolerance must be between 0% and 100%."
    )
  }

  const everyLineValueValid = parsedLineValues.every(
    (value): value is Prisma.Decimal => value !== null && !value.isNegative()
  )
  const everyExpectedValueValid = input.lines.every((line) => line.expectedLineValue !== null)

  const customerLineTotal = everyLineValueValid
    ? money(
        parsedLineValues.reduce(
          (total, value) => total.plus(value as Prisma.Decimal),
          new Prisma.Decimal(0)
        ),
        decimalPlaces
      )
    : null
  const expectedNetTotal = everyExpectedValueValid
    ? money(
        input.lines.reduce(
          (total, line) => total.plus(line.expectedLineValue as Prisma.Decimal),
          new Prisma.Decimal(0)
        ),
        decimalPlaces
      )
    : null

  if (customerNetTotal && customerLineTotal && !customerNetTotal.equals(customerLineTotal)) {
    addIssue(
      issues,
      "STATED_LINE_TOTAL_MISMATCH",
      "The customer-stated release total does not equal the sum of its line values."
    )
  }

  let totalVariance: Prisma.Decimal | null = null
  let totalVariancePercentage: Prisma.Decimal | null = null
  if (customerNetTotal && expectedNetTotal) {
    totalVariance = absolute(customerNetTotal.minus(expectedNetTotal))
    totalVariancePercentage = variancePercentage(totalVariance, expectedNetTotal)

    if (tolerance) {
      const allowance = expectedNetTotal.times(tolerance).dividedBy(100)
      if (totalVariance.greaterThan(allowance)) {
        addIssue(
          issues,
          "RELEASE_TOTAL_PRICE_VARIANCE",
          "The customer-stated release total is outside the configured tolerance."
        )
      }
    }
  }

  if (input.orderType === "BLANKET") {
    const blanket = input.blanket
    if (!blanket || blanket.status !== "ACTIVE") {
      addIssue(issues, "BLANKET_NOT_ACTIVE", "The blanket PO is not active.")
    }

    const validationDate = dateKey(input.validationDate ?? new Date())
    const validFrom = dateKey(blanket?.validFrom)
    const validTo = dateKey(blanket?.validTo)
    if (!validationDate || !validFrom || !validTo || validationDate < validFrom || validationDate > validTo) {
      addIssue(
        issues,
        "BLANKET_OUTSIDE_VALIDITY",
        "The release date is outside the blanket PO validity period."
      )
    }

    const availableValue = decimalOrNull(blanket?.availableValue)
    if (!availableValue || availableValue.isNegative()) {
      addIssue(
        issues,
        "BLANKET_BALANCE_INVALID",
        "The blanket PO available value is unavailable or invalid."
      )
    } else if (expectedNetTotal && expectedNetTotal.greaterThan(availableValue)) {
      addIssue(
        issues,
        "BLANKET_BALANCE_EXCEEDED",
        "The release exceeds the remaining blanket PO value."
      )
    }
  }

  return {
    status: issues.length === 0 ? "READY_FOR_PLANNING" : "PO_CHECK",
    issues,
    customerLineTotal,
    expectedNetTotal,
    varianceAmount: totalVariance,
    variancePercentage: totalVariancePercentage,
  }
}
