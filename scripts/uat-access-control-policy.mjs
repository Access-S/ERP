import assert from "node:assert/strict"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import {
  wouldRemoveLastRecoverableAdministrator,
} from "../src/features/access-control/services/access-control-policy.ts"
import {
  assignUserRolesSchema,
  createCustomRoleSchema,
  setCustomRoleActiveSchema,
  setUserStatusSchema,
  updateCustomRoleSchema,
} from "../src/features/access-control/types/access-control-schema.ts"

const baseCheck = {
  targetIsActive: true,
  targetHasSystemAdmin: true,
  targetWillBeActive: true,
  targetWillHaveSystemAdmin: true,
  otherActiveAdministratorCount: 0,
}

assert.equal(
  wouldRemoveLastRecoverableAdministrator({
    ...baseCheck,
    targetWillHaveSystemAdmin: false,
  }),
  true,
  "must block removing SYSTEM_ADMIN from the only active administrator"
)

assert.equal(
  wouldRemoveLastRecoverableAdministrator({
    ...baseCheck,
    targetWillBeActive: false,
  }),
  true,
  "must block restricting the only active administrator account"
)

assert.equal(
  wouldRemoveLastRecoverableAdministrator({
    ...baseCheck,
    targetWillHaveSystemAdmin: false,
    otherActiveAdministratorCount: 1,
  }),
  false,
  "must allow removal when another active administrator remains"
)

assert.equal(
  wouldRemoveLastRecoverableAdministrator({
    ...baseCheck,
    targetHasSystemAdmin: false,
    targetWillHaveSystemAdmin: false,
  }),
  false,
  "must not treat a non-administrator as the last administrator"
)

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const roleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

assert.deepEqual(
  SYSTEM_ROLES
    .filter((role) => role.permissions.includes("admin.user.invite"))
    .map((role) => role.key),
  ["SYSTEM_ADMIN"],
  "must keep user invitation in the technical administrator role by default"
)

assert.equal(
  assignUserRolesSchema.safeParse({ userId, roleIds: [] }).success,
  false,
  "must reject an active account with no selected roles"
)
const deduplicated = assignUserRolesSchema.parse({
  userId,
  roleIds: [roleId, roleId],
})
assert.deepEqual(deduplicated.roleIds, [roleId], "must deduplicate submitted roles")

assert.equal(
  setUserStatusSchema.safeParse({ userId, status: "INVITED" }).success,
  false,
  "must keep invitation transitions out of the account-status action"
)
assert.equal(
  setUserStatusSchema.safeParse({ userId, status: "SUSPENDED" }).success,
  true,
  "must accept supported status transitions"
)

const customRole = createCustomRoleSchema.parse({
  name: "  Site   Manager  ",
  description: "  Oversees one production site.  ",
  permissionIds: [roleId, roleId],
})
assert.equal(customRole.name, "Site Manager", "must normalize custom-role names")
assert.equal(
  customRole.description,
  "Oversees one production site.",
  "must trim custom-role descriptions"
)
assert.deepEqual(
  customRole.permissionIds,
  [roleId],
  "must deduplicate custom-role permissions"
)
assert.equal(
  createCustomRoleSchema.safeParse({
    name: "X",
    description: "",
    permissionIds: [roleId],
  }).success,
  false,
  "must reject undersized role names"
)
assert.equal(
  updateCustomRoleSchema.safeParse({
    roleId: "not-a-role",
    name: "Site Manager",
    description: "",
    permissionIds: [roleId],
  }).success,
  false,
  "must reject invalid role identifiers"
)
assert.equal(
  setCustomRoleActiveSchema.safeParse({ roleId, isActive: false }).success,
  true,
  "must accept archive status input"
)

console.log("Access Control policy UAT passed (15 checks).")
