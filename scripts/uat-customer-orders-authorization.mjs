import assert from "node:assert/strict"

import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import { AuthorizationError } from "../src/features/auth/services/authorization-policy.ts"
import {
  CUSTOMER_ORDER_OPERATION_PERMISSIONS,
  hasCustomerOrderPermission,
  runAuthorizedCustomerOrderOperation,
} from "../src/features/customer-orders/services/customer-order-authorization.ts"

function principalForRole(roleKey) {
  const role = SYSTEM_ROLES.find((candidate) => candidate.key === roleKey)
  assert.ok(role, `Missing role fixture ${roleKey}`)
  return {
    userId: `user-${roleKey.toLowerCase()}`,
    email: `${roleKey.toLowerCase()}@example.com`,
    normalizedEmail: `${roleKey.toLowerCase()}@example.com`,
    name: role.name,
    status: "ACTIVE",
    authVersion: 1,
    roleKeys: [role.key],
    permissionKeys: role.permissions,
  }
}

function pass(name) {
  console.log(`PASS  ${name}`)
}

assert.deepEqual(CUSTOMER_ORDER_OPERATION_PERMISSIONS, {
  view: ["customer_order.view"],
  create: ["customer_order.view", "customer_order.create"],
  edit: ["customer_order.view", "customer_order.edit"],
  cancel: ["customer_order.view", "customer_order.cancel"],
  amendBlanket: ["customer_order.view", "customer_order.blanket_amend"],
  createRelease: ["customer_order.view", "customer_order.release.create"],
  editRelease: ["customer_order.view", "customer_order.release.edit"],
})
pass("Customer Order operations map to explicit stable permissions")

const customerService = principalForRole("SALES_CUSTOMER_SERVICE")
for (const operation of Object.keys(CUSTOMER_ORDER_OPERATION_PERMISSIONS)) {
  assert.equal(hasCustomerOrderPermission(customerService, operation), true)
}
pass("Sales / Customer Service owns Customer Order entry and correction")

for (const roleKey of [
  "EXECUTIVE_GENERAL_MANAGER",
  "OPERATIONS_MANAGER",
  "PRODUCTION_PLANNER",
  "PRODUCTION_SUPERVISOR",
  "SYSTEM_ADMIN",
]) {
  const principal = principalForRole(roleKey)
  assert.equal(hasCustomerOrderPermission(principal, "view"), true, roleKey)
  for (const operation of [
    "create",
    "edit",
    "cancel",
    "amendBlanket",
    "createRelease",
    "editRelease",
  ]) {
    assert.equal(hasCustomerOrderPermission(principal, operation), false, `${roleKey}:${operation}`)
  }
}
pass("Operational leaders, planners, and System Admin remain read-only")

for (const roleKey of [
  "PROCUREMENT_PURCHASING",
  "WAREHOUSE_INVENTORY",
  "PRODUCTION_OPERATOR_TEAM_LEADER",
  "QUALITY_CONTROL",
  "FINANCE_ACCOUNTS",
]) {
  assert.equal(hasCustomerOrderPermission(principalForRole(roleKey), "view"), false, roleKey)
}
pass("Unrelated default roles receive no Customer Order access")

let allowedWorkRan = false
const result = await runAuthorizedCustomerOrderOperation(customerService, "editRelease", () => {
  allowedWorkRan = true
  return "corrected"
})
assert.equal(result, "corrected")
assert.equal(allowedWorkRan, true)
pass("Allowed Customer Service work reaches the protected operation")

let deniedWorkRan = false
await assert.rejects(
  runAuthorizedCustomerOrderOperation(
    principalForRole("PRODUCTION_PLANNER"),
    "editRelease",
    () => {
      deniedWorkRan = true
      return "must-not-run"
    }
  ),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.code, "PERMISSION_DENIED")
    assert.equal(error.requiredPermission, "customer_order.release.edit")
    return true
  }
)
assert.equal(deniedWorkRan, false)
pass("Denied users cannot reach Customer Order mutations")

