import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import { AuthorizationError } from "../src/features/auth/services/authorization-policy.ts"
import {
  getProductStatusOperation,
  hasProductPermission,
  PRODUCT_OPERATION_PERMISSIONS,
  runAuthorizedProductOperation,
  runAuthorizedProductUpdate,
} from "../src/features/products/services/product-authorization.ts"

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

assert.deepEqual(PRODUCT_OPERATION_PERMISSIONS, {
  view: ["product.view", "bom.view"],
  create: [
    "product.view",
    "bom.view",
    "customer.view",
    "product.create",
    "bom.draft.create",
  ],
  editMaster: ["product.edit_master", "customer.view"],
  editCommercial: ["product.edit_commercial"],
  deactivate: ["product.deactivate", "bom.archive"],
  reactivate: ["product.reactivate"],
})
assert.equal(getProductStatusOperation(false), "deactivate")
assert.equal(getProductStatusOperation(true), "reactivate")
pass("Product operations map to stable and compound permission boundaries")

const systemAdmin = principalForRole("SYSTEM_ADMIN")
assert.equal(hasProductPermission(systemAdmin, "view"), true)
for (const operation of [
  "create",
  "editMaster",
  "editCommercial",
  "deactivate",
  "reactivate",
]) {
  assert.equal(hasProductPermission(systemAdmin, operation), false)
}
pass("System Administrator remains technical and view-only for Products")

const planner = principalForRole("PRODUCTION_PLANNER")
assert.equal(hasProductPermission(planner, "view"), true)
assert.equal(hasProductPermission(planner, "create"), true)
assert.equal(hasProductPermission(planner, "editMaster"), true)
assert.equal(hasProductPermission(planner, "editCommercial"), false)
pass("Production Planner can create Products and edit operational master data")

const finance = principalForRole("FINANCE_ACCOUNTS")
assert.equal(hasProductPermission(finance, "view"), true)
assert.equal(hasProductPermission(finance, "editMaster"), false)
assert.equal(hasProductPermission(finance, "editCommercial"), true)
pass("Finance can edit commercial data without production master access")

const operationsManager = principalForRole("OPERATIONS_MANAGER")
assert.equal(hasProductPermission(operationsManager, "deactivate"), true)
assert.equal(hasProductPermission(operationsManager, "reactivate"), true)
assert.equal(hasProductPermission(operationsManager, "editMaster"), false)
pass("Operations Manager controls Product lifecycle without editing master data")

let allowedUpdateRan = false
await runAuthorizedProductUpdate(planner, { master: {} }, () => {
  allowedUpdateRan = true
})
assert.equal(allowedUpdateRan, true)

let deniedCommercialUpdateRan = false
await assert.rejects(
  runAuthorizedProductUpdate(planner, { commercial: {} }, () => {
    deniedCommercialUpdateRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "product.edit_commercial")
    return true
  }
)
assert.equal(deniedCommercialUpdateRan, false)
pass("Field-scoped updates cannot cross the master/commercial boundary")

const incompleteCreator = {
  ...planner,
  permissionKeys: planner.permissionKeys.filter(
    (permission) => permission !== "bom.draft.create"
  ),
}
let deniedCreateRan = false
await assert.rejects(
  runAuthorizedProductOperation(incompleteCreator, "create", () => {
    deniedCreateRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "bom.draft.create")
    return true
  }
)
assert.equal(deniedCreateRan, false)
pass("Product creation cannot bypass draft BOM authorization")

const incompleteDeactivator = {
  ...operationsManager,
  permissionKeys: operationsManager.permissionKeys.filter(
    (permission) => permission !== "bom.archive"
  ),
}
let deniedDeactivateRan = false
await assert.rejects(
  runAuthorizedProductOperation(incompleteDeactivator, "deactivate", () => {
    deniedDeactivateRan = true
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "bom.archive")
    return true
  }
)
assert.equal(deniedDeactivateRan, false)
pass("Product deactivation cannot bypass BOM archive authorization")
