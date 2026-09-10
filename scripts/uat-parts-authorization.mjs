import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import { AuthorizationError } from "../src/features/auth/services/authorization-policy.ts"
import {
  getPartStatusOperation,
  hasPartPermission,
  PART_OPERATION_PERMISSIONS,
  runAuthorizedPartOperation,
} from "../src/features/parts/services/part-authorization.ts"

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

assert.deepEqual(PART_OPERATION_PERMISSIONS, {
  view: "part.view",
  create: "part.create",
  edit: "part.edit",
  deactivate: "part.deactivate",
  reactivate: "part.reactivate",
})
assert.equal(getPartStatusOperation(false), "deactivate")
assert.equal(getPartStatusOperation(true), "reactivate")
pass("Every Parts operation maps to its stable permission key")

const systemAdmin = principalForRole("SYSTEM_ADMIN")
assert.equal(hasPartPermission(systemAdmin, "view"), true)
assert.equal(hasPartPermission(systemAdmin, "create"), false)
assert.equal(hasPartPermission(systemAdmin, "edit"), false)
assert.equal(hasPartPermission(systemAdmin, "deactivate"), false)
assert.equal(hasPartPermission(systemAdmin, "reactivate"), false)
pass("System Administrator remains technical and view-only for Parts")

const planner = principalForRole("PRODUCTION_PLANNER")
assert.equal(hasPartPermission(planner, "view"), true)
assert.equal(hasPartPermission(planner, "create"), true)
assert.equal(hasPartPermission(planner, "edit"), true)
assert.equal(hasPartPermission(planner, "deactivate"), false)
assert.equal(hasPartPermission(planner, "reactivate"), false)
pass("Production Planner can maintain Part master data without status control")

const operationsManager = principalForRole("OPERATIONS_MANAGER")
assert.equal(hasPartPermission(operationsManager, "view"), true)
assert.equal(hasPartPermission(operationsManager, "create"), false)
assert.equal(hasPartPermission(operationsManager, "edit"), false)
assert.equal(hasPartPermission(operationsManager, "deactivate"), true)
assert.equal(hasPartPermission(operationsManager, "reactivate"), true)
pass("Operations Manager controls Part status without editing master data")

let allowedWorkRan = false
const allowedResult = await runAuthorizedPartOperation(planner, "create", () => {
  allowedWorkRan = true
  return "created"
})
assert.equal(allowedResult, "created")
assert.equal(allowedWorkRan, true)
pass("Allowed direct operation reaches the protected work")

let deniedWorkRan = false
await assert.rejects(
  runAuthorizedPartOperation(systemAdmin, "create", () => {
    deniedWorkRan = true
    return "must-not-run"
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.code, "PERMISSION_DENIED")
    assert.equal(error.status, 403)
    assert.equal(error.requiredPermission, "part.create")
    return true
  }
)
assert.equal(deniedWorkRan, false)
pass("Denied direct operation cannot reach the protected work")
