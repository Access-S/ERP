import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import { AuthorizationError } from "../src/features/auth/services/authorization-policy.ts"
import {
  BOM_OPERATION_PERMISSIONS,
  hasBomPermission,
  runAuthorizedBomOperation,
} from "../src/features/boms/services/bom-authorization.ts"

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

assert.deepEqual(BOM_OPERATION_PERMISSIONS, {
  view: ["bom.view"],
  createDraft: ["bom.view", "bom.draft.create"],
  editDraft: ["bom.view", "bom.draft.edit", "part.view"],
  activate: ["bom.view", "bom.activate", "bom.archive"],
})
pass("BOM operations map to stable and compound permission boundaries")

const systemAdmin = principalForRole("SYSTEM_ADMIN")
assert.equal(hasBomPermission(systemAdmin, "view"), true)
for (const operation of ["createDraft", "editDraft", "activate"]) {
  assert.equal(hasBomPermission(systemAdmin, operation), false)
}
pass("System Administrator remains technical and view-only for BOMs")

const planner = principalForRole("PRODUCTION_PLANNER")
assert.equal(hasBomPermission(planner, "view"), true)
assert.equal(hasBomPermission(planner, "createDraft"), true)
assert.equal(hasBomPermission(planner, "editDraft"), true)
assert.equal(hasBomPermission(planner, "activate"), false)
pass("Production Planner prepares BOM drafts without activation authority")

const operationsManager = principalForRole("OPERATIONS_MANAGER")
assert.equal(hasBomPermission(operationsManager, "view"), true)
assert.equal(hasBomPermission(operationsManager, "createDraft"), false)
assert.equal(hasBomPermission(operationsManager, "editDraft"), false)
assert.equal(hasBomPermission(operationsManager, "activate"), true)
pass("Operations Manager activates BOMs without draft editing authority")

const productionSupervisor = principalForRole("PRODUCTION_SUPERVISOR")
assert.equal(hasBomPermission(productionSupervisor, "view"), true)
assert.equal(hasBomPermission(productionSupervisor, "createDraft"), false)
assert.equal(hasBomPermission(productionSupervisor, "editDraft"), false)
assert.equal(hasBomPermission(productionSupervisor, "activate"), false)
pass("Production Supervisor has read-only BOM access")

let allowedWorkRan = false
const allowedResult = await runAuthorizedBomOperation(planner, "editDraft", () => {
  allowedWorkRan = true
  return "edited"
})
assert.equal(allowedResult, "edited")
assert.equal(allowedWorkRan, true)
pass("Allowed direct draft operation reaches protected work")

let deniedWorkRan = false
await assert.rejects(
  runAuthorizedBomOperation(systemAdmin, "editDraft", () => {
    deniedWorkRan = true
    return "must-not-run"
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.code, "PERMISSION_DENIED")
    assert.equal(error.requiredPermission, "bom.draft.edit")
    return true
  }
)
assert.equal(deniedWorkRan, false)
pass("Denied direct draft operation cannot reach protected work")

const editorWithoutPartView = {
  ...planner,
  permissionKeys: planner.permissionKeys.filter(
    (permission) => permission !== "part.view"
  ),
}
assert.equal(hasBomPermission(editorWithoutPartView, "editDraft"), false)
pass("Draft editing cannot load the Parts Library without Parts visibility")

const activatorWithoutArchive = {
  ...operationsManager,
  permissionKeys: operationsManager.permissionKeys.filter(
    (permission) => permission !== "bom.archive"
  ),
}
let deniedActivationRan = false
await assert.rejects(
  runAuthorizedBomOperation(activatorWithoutArchive, "activate", () => {
    deniedActivationRan = true
    return "must-not-run"
  }),
  (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.requiredPermission, "bom.archive")
    return true
  }
)
assert.equal(deniedActivationRan, false)
pass("BOM activation cannot archive the previous revision without authorization")
