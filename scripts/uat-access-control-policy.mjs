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
import { createPasswordResetSchema } from "../src/features/password-management/types/password-management-schema.ts"
import { reissueInvitationSchema } from "../src/features/user-onboarding/types/user-onboarding-schema.ts"

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
const changeReason = "Approved access change for UAT coverage"

assert.deepEqual(
  SYSTEM_ROLES
    .filter((role) => role.permissions.includes("admin.user.invite"))
    .map((role) => role.key),
  ["SYSTEM_ADMIN"],
  "must keep user invitation in the technical administrator role by default"
)

assert.equal(
  assignUserRolesSchema.safeParse({ userId, roleIds: [], reason: changeReason }).success,
  false,
  "must reject an active account with no selected roles"
)
const deduplicated = assignUserRolesSchema.parse({
  userId,
  roleIds: [roleId, roleId],
  reason: "  Approved   by the security owner  ",
})
assert.deepEqual(deduplicated.roleIds, [roleId], "must deduplicate submitted roles")
assert.equal(
  deduplicated.reason,
  "Approved by the security owner",
  "must normalize the retained access-change reason"
)
assert.equal(
  assignUserRolesSchema.safeParse({ userId, roleIds: [roleId] }).success,
  false,
  "must reject a role change without a reason"
)
assert.equal(
  assignUserRolesSchema.safeParse({ userId, roleIds: [roleId], reason: "Too short" })
    .success,
  false,
  "must reject an undersized access-change reason"
)

assert.equal(
  setUserStatusSchema.safeParse({ userId, status: "INVITED", reason: changeReason })
    .success,
  false,
  "must keep invitation transitions out of the account-status action"
)
assert.equal(
  setUserStatusSchema.safeParse({ userId, status: "SUSPENDED", reason: changeReason })
    .success,
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
    reason: changeReason,
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
  setCustomRoleActiveSchema.safeParse({
    roleId,
    isActive: false,
    reason: changeReason,
  }).success,
  true,
  "must accept archive status input"
)

assert.equal(
  createPasswordResetSchema.safeParse({ userId }).success,
  false,
  "must reject an administrator password reset without a reason"
)
assert.equal(
  createPasswordResetSchema.safeParse({ userId, reason: changeReason }).success,
  true,
  "must accept an administrator password reset with a reason"
)
assert.equal(
  reissueInvitationSchema.safeParse({ userId }).success,
  false,
  "must reject activation-link replacement without a reason"
)
assert.equal(
  reissueInvitationSchema.safeParse({ userId, reason: changeReason }).success,
  true,
  "must accept activation-link replacement with a reason"
)

console.log("Access Control policy UAT passed (22 checks).")
