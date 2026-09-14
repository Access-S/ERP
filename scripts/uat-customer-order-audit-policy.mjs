import assert from "node:assert/strict"

import {
  CUSTOMER_ORDER_AUDIT_EVENT_TYPES,
  sanitizeCustomerOrderAuditMetadata,
} from "../src/features/customer-orders/services/customer-order-audit-policy.ts"

assert.equal(new Set(CUSTOMER_ORDER_AUDIT_EVENT_TYPES).size, CUSTOMER_ORDER_AUDIT_EVENT_TYPES.length)

assert.deepEqual(
  sanitizeCustomerOrderAuditMetadata("customer_order.release.revised", {
    revision: 2,
    changedFields: ["orderedQuantity", "requestedDeliveryDate"],
    reason: "Customer issued an updated call-off",
    customerEmail: "must-not-be-recorded@example.com",
    documentContent: "must not be copied",
    arbitrary: "not allow-listed",
  }),
  {
    revision: 2,
    changedFields: ["orderedQuantity", "requestedDeliveryDate"],
    reason: "Customer issued an updated call-off",
  }
)

assert.deepEqual(
  sanitizeCustomerOrderAuditMetadata("customer_order.blanket.amended", {
    valueDelta: "10000.00",
    previousAuthorizedValue: "60000.00",
    resultingAuthorizedValue: "70000.00",
    token: "must-not-be-recorded",
  }),
  {
    valueDelta: "10000.00",
    previousAuthorizedValue: "60000.00",
    resultingAuthorizedValue: "70000.00",
  }
)

console.log("Customer Order audit policy UAT passed.")

