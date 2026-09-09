import assert from "node:assert/strict"
import {
  assertPermission,
  AuthorizationError,
  hasPermission,
  resolvePrincipalFromAccessRecord,
} from "../src/features/auth/services/authorization-policy.ts"

const validSession = { userId: "user-1", authVersion: 3 }

function activeUser(overrides = {}) {
  return {
    id: "user-1",
    email: "planner@example.com",
    normalizedEmail: "planner@example.com",
    name: "Planner",
    status: "ACTIVE",
    authVersion: 3,
    roleAssignments: [
      {
        role: {
          key: "PRODUCTION_PLANNER",
          isActive: true,
          rolePermissions: [
            { permission: { key: "product.view", isActive: true } },
            { permission: { key: "bom.draft.edit", isActive: true } },
            { permission: { key: "retired.permission", isActive: true } },
          ],
        },
      },
      {
        role: {
          key: "FINANCE_ACCOUNTS",
          isActive: true,
          rolePermissions: [
            { permission: { key: "product.view", isActive: true } },
            { permission: { key: "customer.edit_financial", isActive: true } },
            { permission: { key: "bom.activate", isActive: false } },
          ],
        },
      },
      {
        role: {
          key: "INACTIVE_ROLE",
          isActive: false,
          rolePermissions: [
            { permission: { key: "bom.activate", isActive: true } },
          ],
        },
      },
    ],
    ...overrides,
  }
}

function expectAuthorizationError(callback, code, status) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AuthorizationError)
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    return true
  })
}

function pass(name) {
  console.log(`PASS  ${name}`)
}

expectAuthorizationError(
  () => resolvePrincipalFromAccessRecord(null, null),
  "AUTHENTICATION_REQUIRED",
  401
)
pass("Unauthenticated session is rejected")

expectAuthorizationError(
  () => resolvePrincipalFromAccessRecord({ userId: "user-1" }, null),
  "SESSION_STALE",
  401
)
pass("Legacy session without authVersion is rejected")

expectAuthorizationError(
  () => resolvePrincipalFromAccessRecord(validSession, null),
  "SESSION_USER_NOT_FOUND",
  401
)
pass("Deleted or missing session user is rejected")

expectAuthorizationError(
  () => resolvePrincipalFromAccessRecord(
    { ...validSession, authVersion: 2 },
    activeUser()
  ),
  "SESSION_STALE",
  401
)
pass("Stale session version is rejected")

for (const status of ["INVITED", "SUSPENDED", "DISABLED"]) {
  expectAuthorizationError(
    () => resolvePrincipalFromAccessRecord(validSession, activeUser({ status })),
    "ACCOUNT_NOT_ACTIVE",
    403
  )
}
pass("Every non-active account state is rejected")

const principal = resolvePrincipalFromAccessRecord(validSession, activeUser())
assert.deepEqual(principal.roleKeys, ["FINANCE_ACCOUNTS", "PRODUCTION_PLANNER"])
assert.deepEqual(principal.permissionKeys, [
  "bom.draft.edit",
  "customer.edit_financial",
  "product.view",
])
assert.equal(hasPermission(principal, "product.view"), true)
assert.equal(hasPermission(principal, "bom.activate"), false)
assert.doesNotThrow(() => assertPermission(principal, "bom.draft.edit"))
expectAuthorizationError(
  () => assertPermission(principal, "bom.activate"),
  "PERMISSION_DENIED",
  403
)
pass("Multi-role permissions are combined, deduplicated, and filtered")
pass("Allowed and denied permission paths are distinct")
