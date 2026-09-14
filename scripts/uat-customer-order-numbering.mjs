import assert from "node:assert/strict"

import {
  CUSTOMER_ORDER_COUNTER_KEY,
  CUSTOMER_RELEASE_COUNTER_KEY,
  formatCustomerOrderNumber,
} from "../src/features/customer-orders/services/customer-order-numbering.ts"

assert.notEqual(CUSTOMER_ORDER_COUNTER_KEY, CUSTOMER_RELEASE_COUNTER_KEY)
assert.equal(
  formatCustomerOrderNumber("ORDER", 1n, new Date("2026-09-14T00:00:00.000Z")),
  "CO-2026-000001"
)
assert.equal(
  formatCustomerOrderNumber("RELEASE", 27n, new Date("2026-09-14T00:00:00.000Z")),
  "COR-2026-000027"
)
assert.throws(
  () => formatCustomerOrderNumber("ORDER", 0n, new Date("2026-09-14T00:00:00.000Z")),
  /positive/
)

console.log("Customer Order numbering policy UAT passed.")

