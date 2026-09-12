import { PrismaClient } from "@prisma/client"
import {
  mapLegacyRole,
  PERMISSIONS,
  SYSTEM_ROLES,
} from "../src/features/auth/config/authorization-registry.ts"

const prisma = new PrismaClient()

function summarizeLegacyRoles(users) {
  const counts = new Map()

  for (const user of users) {
    counts.set(user.role, (counts.get(user.role) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([role, count]) => ({
      role,
      count,
      targetRole: mapLegacyRole(role),
    }))
    .sort((left, right) => left.role.localeCompare(right.role))
}

function countNormalizedEmailDuplicates(users) {
  const seen = new Set()
  let duplicateCount = 0

  for (const user of users) {
    const normalized = user.email.trim().toLowerCase()
    if (seen.has(normalized)) duplicateCount += 1
    seen.add(normalized)
  }

  return duplicateCount
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT to_regclass(${`public.${tableName}`})::text AS relation_name
  `
  return Boolean(rows[0]?.relation_name)
}

async function getAuthorizationSummary() {
  const hasRoles = await tableExists("roles")
  const hasPermissions = await tableExists("permissions")
  const hasUserRoles = await tableExists("user_roles")
  const hasRolePermissions = await tableExists("role_permissions")

  if (!hasRoles || !hasPermissions || !hasUserRoles || !hasRolePermissions) {
    return {
      installed: false,
      tables: {
        roles: hasRoles,
        permissions: hasPermissions,
        userRoles: hasUserRoles,
        rolePermissions: hasRolePermissions,
      },
    }
  }

  const [counts] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM roles) AS roles,
      (SELECT COUNT(*)::int FROM permissions) AS permissions,
      (SELECT COUNT(*)::int FROM user_roles) AS user_roles,
      (SELECT COUNT(*)::int FROM role_permissions) AS role_permissions,
      (
        SELECT COUNT(*)::int
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
        )
      ) AS users_without_roles,
      (
        SELECT COUNT(*)::int
        FROM roles r
        WHERE r.is_active
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id
          )
      ) AS active_roles_without_permissions,
      (
        SELECT COUNT(*)::int
        FROM users
        WHERE normalized_email <> LOWER(BTRIM(email))
      ) AS users_with_non_normalized_email
  `

  return { installed: true, ...counts }
}

async function getOnboardingSummary() {
  const installed = await tableExists("user_invitations")
  if (!installed) return { installed: false }

  const [summary] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM user_invitations) AS invitations,
      (
        SELECT COUNT(*)::int FROM users
        WHERE status = 'INVITED' AND password IS NOT NULL
      ) AS invited_users_with_passwords,
      (
        SELECT COUNT(*)::int FROM users
        WHERE status = 'ACTIVE' AND password IS NULL
      ) AS active_users_without_passwords,
      (
        SELECT COUNT(*)::int
        FROM user_invitations ui
        JOIN users u ON u.id = ui.user_id
        WHERE ui.used_at IS NULL
          AND ui.revoked_at IS NULL
          AND u.status <> 'INVITED'
      ) AS open_invitations_for_non_invited_users,
      (
        SELECT COUNT(*)::int FROM (
          SELECT user_id
          FROM user_invitations
          WHERE used_at IS NULL AND revoked_at IS NULL
          GROUP BY user_id
          HAVING COUNT(*) > 1
        ) duplicate_open_invitations
      ) AS users_with_multiple_open_invitations
  `

  return { installed: true, ...summary }
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort()
}

async function compareAuthorizationRegistry() {
  const expectedPermissionKeys = new Set(PERMISSIONS.map((permission) => permission.key))
  const expectedRoleKeys = new Set(SYSTEM_ROLES.map((role) => role.key))

  const [databasePermissions, databaseRoles] = await Promise.all([
    prisma.permission.findMany({
      where: { key: { in: [...expectedPermissionKeys] } },
      select: { key: true, isActive: true },
    }),
    prisma.role.findMany({
      where: { isSystem: true },
      select: {
        key: true,
        isActive: true,
        rolePermissions: {
          select: { permission: { select: { key: true } } },
        },
      },
    }),
  ])

  const rolesByKey = new Map(databaseRoles.map((role) => [role.key, role]))
  const missingPermissions = difference(
    expectedPermissionKeys,
    new Set(databasePermissions.map((permission) => permission.key))
  )
  const inactivePermissions = databasePermissions
    .filter((permission) => !permission.isActive)
    .map((permission) => permission.key)
    .sort()
  const missingSystemRoles = difference(expectedRoleKeys, new Set(rolesByKey.keys()))
  const unexpectedSystemRoles = difference(new Set(rolesByKey.keys()), expectedRoleKeys)
  const inactiveSystemRoles = databaseRoles
    .filter((role) => !role.isActive)
    .map((role) => role.key)
    .sort()
  const grantMismatches = []

  for (const roleDefinition of SYSTEM_ROLES) {
    const databaseRole = rolesByKey.get(roleDefinition.key)
    if (!databaseRole) continue

    const expectedGrants = new Set(roleDefinition.permissions)
    const actualGrants = new Set(
      databaseRole.rolePermissions.map((grant) => grant.permission.key)
    )
    const missing = difference(expectedGrants, actualGrants)
    const unexpected = difference(actualGrants, expectedGrants)

    if (missing.length > 0 || unexpected.length > 0) {
      grantMismatches.push({ role: roleDefinition.key, missing, unexpected })
    }
  }

  return {
    expectedRoles: SYSTEM_ROLES.length,
    expectedPermissions: PERMISSIONS.length,
    missingSystemRoles,
    unexpectedSystemRoles,
    inactiveSystemRoles,
    missingPermissions,
    inactivePermissions,
    grantMismatches,
  }
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      roleAssignments: { select: { roleId: true } },
    },
  })
  const legacyRoles = summarizeLegacyRoles(users)
  const unmappedLegacyRoles = [...new Set(
    users
      .filter((user) => user.roleAssignments.length === 0 && !mapLegacyRole(user.role))
      .map((user) => user.role)
  )].sort()

  const [authorization, onboarding] = await Promise.all([
    getAuthorizationSummary(),
    getOnboardingSummary(),
  ])
  const registry = authorization.installed
    ? await compareAuthorizationRegistry()
    : null
  const report = {
    userCount: users.length,
    normalizedEmailDuplicateCount: countNormalizedEmailDuplicates(users),
    legacyRoles,
    unmappedLegacyRoles,
    authorization,
    onboarding,
    registry,
  }

  console.log(JSON.stringify(report, null, 2))

  if (report.normalizedEmailDuplicateCount > 0 || unmappedLegacyRoles.length > 0) {
    process.exitCode = 1
  }
  if (
    report.authorization.installed &&
    (report.authorization.users_without_roles > 0 ||
      report.authorization.active_roles_without_permissions > 0 ||
      report.authorization.users_with_non_normalized_email > 0)
  ) {
    process.exitCode = 1
  }
  if (
    registry &&
    (registry.missingSystemRoles.length > 0 ||
      registry.unexpectedSystemRoles.length > 0 ||
      registry.inactiveSystemRoles.length > 0 ||
      registry.missingPermissions.length > 0 ||
      registry.inactivePermissions.length > 0 ||
      registry.grantMismatches.length > 0)
  ) {
    process.exitCode = 1
  }
  if (
    report.onboarding.installed &&
    (report.onboarding.invited_users_with_passwords > 0 ||
      report.onboarding.active_users_without_passwords > 0 ||
      report.onboarding.open_invitations_for_non_invited_users > 0 ||
      report.onboarding.users_with_multiple_open_invitations > 0)
  ) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error("Authentication foundation audit failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
