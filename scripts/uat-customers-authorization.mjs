import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import { AuthorizationError } from "../src/features/auth/services/authorization-policy.ts"
import {
  CUSTOMER_OPERATION_PERMISSIONS,
  getCustomerStatusOperation,
  hasCustomerPermission,
  runAuthorizedCustomerCreate,
  runAuthorizedCustomerOperation,
  runAuthorizedCustomerUpdate,
} from "../src/features/customers/services/customer-authorization.ts"

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

assert.deepEqual(CUSTOMER_OPERATION_PERMISSIONS, {
  view: ["customer.view"],
  create: ["customer.view", "customer.create"],
  editIdentity: ["customer.edit_identity"],
  editContacts: ["customer.edit_contacts"],
  editFinancial: ["customer.edit_financial"],
  deactivate: ["customer.deactivate"],
  reactivate: ["customer.reactivate"],
})
assert.equal(getCustomerStatusOperation(false), "deactivate")
assert.equal(getCustomerStatusOperation(true), "reactivate")
pass("Customer operations map to stable and field-scoped permissions")

const systemAdmin = principalForRole("SYSTEM_ADMIN")
assert.equal(hasCustomerPermission(systemAdmin, "view"), true)
for (const operation of [
  "create",
  "editIdentity",
  "editContacts",
  "editFinancial",
  "deactivate",
  "reactivate",
]) {
  assert.equal(hasCustomerPermission(systemAdmin, operation), false)
}
pass("System Administrator remains technical and view-only for Customers")

const sales = principalForRole("SALES_CUSTOMER_SERVICE")
assert.equal(hasCustomerPermission(sales, "view"), true)
assert.equal(hasCustomerPermission(sales, "create"), true)
assert.equal(hasCustomerPermission(sales, "editIdentity"), true)
assert.equal(hasCustomerPermission(sales, "editContacts"), true)
assert.equal(hasCustomerPermission(sales, "editFinancial"), false)
assert.equal(hasCustomerPermission(sales, "deactivate"), false)
pass("Sales maintains Customer identity and contacts without financial or lifecycle authority")

const finance = principalForRole("FINANCE_ACCOUNTS")
assert.equal(hasCustomerPermission(finance, "view"), true)
assert.equal(hasCustomerPermission(finance, "create"), false)
assert.equal(hasCustomerPermission(finance, "editIdentity"), false)
assert.equal(hasCustomerPermission(finance, "editContacts"), false)
assert.equal(hasCustomerPermission(finance, "editFinancial"), true)
pass("Finance maintains Customer financial controls without identity access")

const operationsManager = principalForRole("OPERATIONS_MANAGER")
assert.equal(hasCustomerPermission(operationsManager, "view"), true)
assert.equal(hasCustomerPermission(operationsManager, "editIdentity"), false)
assert.equal(hasCustomerPermission(operationsManager, "deactivate"), true)
assert.equal(hasCustomerPermission(operationsManager, "reactivate"), true)
pass("Operations Manager controls Customer lifecycle without editing master fields")

let allowedWorkRan = false
await runAuthorizedCustomerUpdate(sales, { contacts: {} }, () => {
  allowedWorkRan = true
})
assert.equal(allowedWorkRan, true)

let deniedFinancialUpdateRan = false
await assert.rejects(
  runAuthorizedCustomerUpdate(sales, { financial: {} }, () => {
    deniedFinancialUpdateRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "customer.edit_financial")
    return true
  }
)
assert.equal(deniedFinancialUpdateRan, false)
pass("Customer updates cannot cross identity, contact, and financial field boundaries")

let deniedFinancialCreateRan = false
await assert.rejects(
  runAuthorizedCustomerCreate(sales, { financial: {} }, () => {
    deniedFinancialCreateRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "customer.edit_financial")
    return true
  }
)
assert.equal(deniedFinancialCreateRan, false)
pass("Customer creation cannot initialize controlled financial fields without authority")

const combinedPermissions = [...new Set([
  ...sales.permissionKeys,
  ...finance.permissionKeys,
])]
const salesAndFinance = {
  ...sales,
  roleKeys: [...sales.roleKeys, ...finance.roleKeys],
  permissionKeys: combinedPermissions,
}
let combinedCreateRan = false
await runAuthorizedCustomerCreate(
  salesAndFinance,
  { contacts: {}, financial: {} },
  () => {
    combinedCreateRan = true
  }
)
assert.equal(combinedCreateRan, true)
pass("Multiple roles combine to permit a fully populated Customer creation")

let deniedLifecycleRan = false
await assert.rejects(
  runAuthorizedCustomerOperation(sales, "deactivate", () => {
    deniedLifecycleRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "customer.deactivate")
    return true
  }
)
assert.equal(deniedLifecycleRan, false)
pass("Denied Customer lifecycle operation cannot reach protected work")
