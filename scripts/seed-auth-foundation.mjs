import { PrismaClient } from "@prisma/client"
import {
  mapLegacyRole,
  PERMISSIONS,
  SYSTEM_ROLES,
} from "../src/features/auth/config/authorization-registry.ts"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, role: true, roleAssignments: { select: { roleId: true } } },
  })
  const unmappedRoles = [...new Set(
    users
      .filter((user) => user.roleAssignments.length === 0 && !mapLegacyRole(user.role))
      .map((user) => user.role)
  )]

  if (unmappedRoles.length > 0) {
    throw new Error(`Cannot seed user-role assignments. Unmapped legacy roles: ${unmappedRoles.join(", ")}`)
  }

  await prisma.$transaction(async (tx) => {
    for (const permission of PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: permission.key },
        update: {
          module: permission.module,
          description: permission.description,
          isActive: true,
        },
        create: {
          key: permission.key,
          module: permission.module,
          description: permission.description,
          isActive: true,
        },
      })
    }

    for (const roleDefinition of SYSTEM_ROLES) {
      const role = await tx.role.upsert({
        where: { key: roleDefinition.key },
        update: {
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
          isActive: true,
        },
        create: {
          key: roleDefinition.key,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
          isActive: true,
        },
      })

      const permissions = await tx.permission.findMany({
        where: { key: { in: [...roleDefinition.permissions] } },
        select: { id: true, key: true },
      })

      if (permissions.length !== roleDefinition.permissions.length) {
        const found = new Set(permissions.map((permission) => permission.key))
        const missing = roleDefinition.permissions.filter((key) => !found.has(key))
        throw new Error(`Role ${roleDefinition.key} references missing permissions: ${missing.join(", ")}`)
      }

      for (const permission of permissions) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        })
      }
    }

    const roles = await tx.role.findMany({
      where: { key: { in: SYSTEM_ROLES.map((role) => role.key) } },
      select: { id: true, key: true },
    })
    const rolesByKey = new Map(roles.map((role) => [role.key, role.id]))

    for (const user of users) {
      if (user.roleAssignments.length > 0) continue
      const targetRoleKey = mapLegacyRole(user.role)
      const roleId = targetRoleKey ? rolesByKey.get(targetRoleKey) : undefined

      if (!targetRoleKey || !roleId) {
        throw new Error(`No target role exists for legacy role ${user.role}`)
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId,
        },
      })
    }
  }, { timeout: 30_000 })

  const [roleCount, permissionCount, rolePermissionCount, userRoleCount] = await Promise.all([
    prisma.role.count({ where: { isSystem: true, isActive: true } }),
    prisma.permission.count({ where: { isActive: true } }),
    prisma.rolePermission.count(),
    prisma.userRole.count(),
  ])

  console.log(JSON.stringify({
    roles: roleCount,
    permissions: permissionCount,
    rolePermissions: rolePermissionCount,
    userRoles: userRoleCount,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Authentication foundation seed failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
