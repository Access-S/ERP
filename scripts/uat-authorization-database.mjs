import assert from "node:assert/strict"
import { PrismaClient, UserStatus } from "@prisma/client"
import { authorizationUserSelect } from "../src/features/auth/services/authorization-user-select.ts"
import {
  assertPermission,
  AuthorizationError,
  hasPermission,
  resolvePrincipalFromAccessRecord,
} from "../src/features/auth/services/authorization-policy.ts"
import { hasPartPermission } from "../src/features/parts/services/part-authorization.ts"
import { hasProductPermission } from "../src/features/products/services/product-authorization.ts"

const prisma = new PrismaClient()

function pass(name) {
  console.log(`PASS  ${name}`)
}

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      status: UserStatus.ACTIVE,
      roleAssignments: {
        some: { role: { key: "SYSTEM_ADMIN", isActive: true } },
      },
    },
    select: authorizationUserSelect,
  })

  assert.ok(user, "An active SYSTEM_ADMIN user is required for database UAT")

  const principal = resolvePrincipalFromAccessRecord(
    { userId: user.id, authVersion: user.authVersion },
    user
  )

  assert.ok(principal.roleKeys.includes("SYSTEM_ADMIN"))
  for (const permission of [
    "admin.user.view",
    "admin.user.manage",
    "admin.role.assign",
    "admin.configuration.manage",
    "admin.integration.manage",
    "admin.audit.view",
  ]) {
    assertPermission(principal, permission)
  }
  pass("Live SYSTEM_ADMIN receives technical administration permissions")

  for (const permission of [
    "bom.activate",
    "purchase_order.approve",
    "quality.release",
  ]) {
    assert.equal(hasPermission(principal, permission), false)
  }
  pass("Technical administration does not imply business approval authority")

  assert.equal(hasPartPermission(principal, "view"), true)
  for (const operation of ["create", "edit", "deactivate", "reactivate"]) {
    assert.equal(hasPartPermission(principal, operation), false)
  }
  pass("Live SYSTEM_ADMIN is view-only in the protected Parts module")

  assert.equal(hasProductPermission(principal, "view"), true)
  for (const operation of [
    "create",
    "editMaster",
    "editCommercial",
    "deactivate",
    "reactivate",
  ]) {
    assert.equal(hasProductPermission(principal, operation), false)
  }
  pass("Live SYSTEM_ADMIN is view-only in the protected Products module")

  assert.throws(
    () => resolvePrincipalFromAccessRecord(
      { userId: user.id, authVersion: user.authVersion + 1 },
      user
    ),
    (error) => {
      assert.ok(error instanceof AuthorizationError)
      assert.equal(error.code, "SESSION_STALE")
      assert.equal(error.status, 401)
      return true
    }
  )
  pass("Live user record rejects a mismatched session version")
}

main()
  .catch((error) => {
    console.error("Authorization database UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
