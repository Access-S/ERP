import assert from "node:assert/strict"

import {
  CUSTOMER_ORDER_AUDIT_EVENT_TYPES,
  sanitizeCustomerOrderAuditMetadata,
} from "../src/features/customer-orders/services/customer-order-audit-policy.ts"

assert.equal(new Set(CUSTOMER_ORDER_AUDIT_EVENT_TYPES).size, CUSTOMER_ORDER_AUDIT_EVENT_TYPES.length)

assert.deepEqual(
  sanitizeCustomerOrderAuditMetadata("customer_order.legacy_imported", {
    legacyPurchaseOrderId: "018f53ce-42a8-7000-8000-000000000001",
    legacyStatus: "Open",
    internalOrderNumber: "LEGACY-PO-45001",
    customerEmail: "must-not-be-recorded@example.com",
  }),
  {
    legacyPurchaseOrderId: "018f53ce-42a8-7000-8000-000000000001",
    legacyStatus: "Open",
    internalOrderNumber: "LEGACY-PO-45001",
  }
)

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

assert.deepEqual(
  sanitizeCustomerOrderAuditMetadata("customer_order.release.cancelled", {
    previousStatus: "READY_FOR_PLANNING",
    nextStatus: "CANCELLED",
    reason: "Customer cancelled this release by email.",
    customerEmail: "must-not-be-recorded@example.com",
  }),
  {
    previousStatus: "READY_FOR_PLANNING",
    nextStatus: "CANCELLED",
    reason: "Customer cancelled this release by email.",
  }
)

console.log("Customer Order audit policy UAT passed.")
