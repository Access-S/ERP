import assert from "node:assert/strict"

import {
  calculateBlanketBalance,
  canCommitBlanketRelease,
} from "../src/features/customer-orders/services/blanket-balance.ts"
import {
  validateCustomerOrderLine,
  validateCustomerOrderRelease,
} from "../src/features/customer-orders/services/customer-order-validation.ts"
import {
  addBlanketAmendmentInputSchema,
  cancelCustomerOrderInputSchema,
  createBlanketCustomerOrderInputSchema,
  createBlanketReleaseInputSchema,
  createStandardCustomerOrderInputSchema,
} from "../src/features/customer-orders/types/customer-order-schema.ts"

const CUSTOMER_ID = "customer-1"

function pass(name) {
  console.log(`PASS  ${name}`)
}

function line(overrides = {}) {
  return validateCustomerOrderLine({
    customerActive: true,
    selectedCustomerId: CUSTOMER_ID,
    productActive: true,
    productCustomerId: CUSTOMER_ID,
    activeBomId: "bom-1",
    orderedQuantity: "2400",
    orderUom: "UNIT",
    requestedDeliveryDate: "2026-10-01",
    unitsPerShipper: "24",
    approvedPricePerShipper: "10",
    customerLineValue: "1000",
    tolerancePercentage: "0",
    ...overrides,
  })
}

function release(lines, lineCustomerValues, overrides = {}) {
  return validateCustomerOrderRelease({
    orderType: "STANDARD",
    customerNetTotal: lineCustomerValues
      .reduce((total, value) => total + Number(value), 0)
      .toFixed(2),
    lines,
    lineCustomerValues,
    tolerancePercentage: "0",
    validationDate: new Date("2026-09-14T00:00:00.000Z"),
    ...overrides,
  })
}

const example = line()
assert.equal(example.status, "VALID")
assert.equal(example.calculatedShippers?.toFixed(), "100")
assert.equal(example.expectedLineValue?.toFixed(2), "1000.00")
assert.equal(example.varianceAmount?.toFixed(2), "0.00")
pass("2,400 units / 24 produces 100 shippers and $1,000 expected value")

const incompleteShipper = line({ orderedQuantity: "25", customerLineValue: "10.42" })
assert.equal(incompleteShipper.status, "PO_CHECK")
assert.ok(incompleteShipper.issues.some((issue) => issue.code === "INCOMPLETE_SHIPPER"))
pass("Incomplete shippers are blocked")

const wholeQuantity = line({ orderedQuantity: "24.5", customerLineValue: "10.21" })
assert.ok(wholeQuantity.issues.some((issue) => issue.code === "QUANTITY_MUST_BE_WHOLE"))
pass("Fractional unit or shipper quantities are blocked")

const withinOnePercent = line({ customerLineValue: "1009", tolerancePercentage: "1" })
assert.equal(withinOnePercent.status, "VALID")
const outsideOnePercent = line({ customerLineValue: "1011", tolerancePercentage: "1" })
assert.ok(outsideOnePercent.issues.some((issue) => issue.code === "LINE_PRICE_VARIANCE"))
pass("Configured percentage tolerance is inclusive at its boundary")

const strictDefault = line({ customerLineValue: "1000.01" })
assert.ok(strictDefault.issues.some((issue) => issue.code === "LINE_PRICE_VARIANCE"))
pass("The safe 0% rollout tolerance requires an exact price match")

const wrongCustomer = line({ productCustomerId: "customer-2" })
assert.ok(wrongCustomer.issues.some((issue) => issue.code === "PRODUCT_CUSTOMER_MISMATCH"))
const noActiveBom = line({ activeBomId: null })
assert.ok(noActiveBom.issues.some((issue) => issue.code === "ACTIVE_BOM_REQUIRED"))
pass("Customer assignment and active BOM are required before planning")

const overLine = line({
  orderedQuantity: "100",
  orderUom: "SHIPPER",
  customerLineValue: "1011",
  tolerancePercentage: "1",
})
const underLine = line({
  orderedQuantity: "100",
  orderUom: "SHIPPER",
  customerLineValue: "989",
  tolerancePercentage: "1",
})
const offsettingRelease = release([overLine, underLine], ["1011", "989"], {
  customerNetTotal: "2000",
  tolerancePercentage: "1",
})
assert.equal(offsettingRelease.expectedNetTotal?.toFixed(2), "2000.00")
assert.equal(offsettingRelease.varianceAmount?.toFixed(2), "0.00")
assert.equal(offsettingRelease.status, "PO_CHECK")
assert.ok(offsettingRelease.issues.some((issue) => issue.code === "LINE_VALIDATION_FAILED"))
pass("Opposing line errors cannot hide behind a correct release total")

const mismatchedStatedTotal = release([example], ["1000"], { customerNetTotal: "999" })
assert.ok(
  mismatchedStatedTotal.issues.some((issue) => issue.code === "STATED_LINE_TOTAL_MISMATCH")
)
pass("Header total must equal the stated line total")

const blanketBalance = calculateBlanketBalance({
  originalAuthorizedValue: "60000",
  amendmentValues: ["10000"],
  committedReleaseValues: ["30000", "33000"],
})
assert.equal(blanketBalance.currentAuthorizedValue.toFixed(2), "70000.00")
assert.equal(blanketBalance.committedValue.toFixed(2), "63000.00")
assert.equal(blanketBalance.availableValue.toFixed(2), "7000.00")
assert.equal(canCommitBlanketRelease(blanketBalance, "7000"), true)
assert.equal(canCommitBlanketRelease(blanketBalance, "7000.01"), false)
pass("Blanket top-ups and committed releases produce an exact available balance")

const validBlanketRelease = release([example], ["1000"], {
  orderType: "BLANKET",
  blanket: {
    status: "ACTIVE",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    availableValue: "1000",
  },
})
assert.equal(validBlanketRelease.status, "READY_FOR_PLANNING")
pass("A blanket release may spend exactly its available value")

const exceededBlanketRelease = release([example], ["1000"], {
  orderType: "BLANKET",
  blanket: {
    status: "ACTIVE",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    availableValue: "999.99",
  },
})
assert.ok(
  exceededBlanketRelease.issues.some((issue) => issue.code === "BLANKET_BALANCE_EXCEEDED")
)
pass("A blanket release cannot exceed its available value")

const expiredBlanketRelease = release([example], ["1000"], {
  orderType: "BLANKET",
  blanket: {
    status: "ACTIVE",
    validFrom: "2025-01-01",
    validTo: "2025-12-31",
    availableValue: "5000",
  },
})
assert.ok(
  expiredBlanketRelease.issues.some((issue) => issue.code === "BLANKET_OUTSIDE_VALIDITY")
)
pass("A release outside blanket validity is blocked")

assert.throws(
  () =>
    calculateBlanketBalance({
      originalAuthorizedValue: "60000",
      amendmentValues: ["-1"],
      committedReleaseValues: [],
    }),
  /positive top-ups/
)
pass("Blanket reductions are rejected until their future rules are designed")

const validFormInput = {
  customerId: "11111111-1111-4111-8111-111111111111",
  customerPoNumber: "UAT-PO-001",
  receivedDate: "2026-09-14",
  customerReleaseReference: "",
  defaultRequestedDeliveryDate: "2026-10-01",
  customerNetTotal: "1000.00",
  lines: [{
    productId: "22222222-2222-4222-8222-222222222222",
    orderUom: "UNIT",
    orderedQuantity: "2400",
    requestedDeliveryDate: "",
    customerLineValue: "1000.00",
  }],
}
assert.equal(createStandardCustomerOrderInputSchema.safeParse(validFormInput).success, true)
assert.equal(
  createStandardCustomerOrderInputSchema.safeParse({
    ...validFormInput,
    receivedDate: "2026-02-30",
  }).success,
  false
)
assert.equal(
  createStandardCustomerOrderInputSchema.safeParse({
    ...validFormInput,
    customerNetTotal: "1000.001",
  }).success,
  false
)
assert.equal(
  cancelCustomerOrderInputSchema.safeParse({
    orderId: validFormInput.customerId,
    releaseId: validFormInput.lines[0].productId,
    reason: "too short",
  }).success,
  false
)
pass("Form boundaries reject impossible dates, excess money precision, and weak cancellation reasons")

const validBlanketHeader = {
  customerId: validFormInput.customerId,
  customerPoNumber: "UAT-BLANKET-001",
  originalAuthorizedValue: "60000.00",
  receivedDate: "2026-09-15",
  validFrom: "2026-09-15",
  validTo: "2027-09-14",
}
assert.equal(createBlanketCustomerOrderInputSchema.safeParse(validBlanketHeader).success, true)
assert.equal(
  createBlanketCustomerOrderInputSchema.safeParse({
    ...validBlanketHeader,
    originalAuthorizedValue: "0",
  }).success,
  false
)
assert.equal(
  createBlanketCustomerOrderInputSchema.safeParse({
    ...validBlanketHeader,
    validTo: "2026-09-14",
  }).success,
  false
)
assert.equal(
  createBlanketReleaseInputSchema.safeParse({
    orderId: validFormInput.customerId,
    receivedDate: validFormInput.receivedDate,
    customerReleaseReference: "",
    defaultRequestedDeliveryDate: validFormInput.defaultRequestedDeliveryDate,
    customerNetTotal: validFormInput.customerNetTotal,
    lines: validFormInput.lines,
  }).success,
  true
)
assert.equal(
  addBlanketAmendmentInputSchema.safeParse({
    orderId: validFormInput.customerId,
    valueDelta: "10000.00",
    customerReference: "UAT-TOP-UP-1",
    receivedDate: "2026-09-15",
    effectiveDate: "2026-09-15",
    reason: "Customer increased the annual PO authority.",
  }).success,
  true
)
pass("Blanket header, release, and positive top-up form boundaries are enforced")

console.log("\nCustomer Order domain validation passed without database writes.")
