import "server-only"

import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  createAuditCorrelationId,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"
import { AccessControlWorkflowError } from "./access-control-service"

type CustomRoleValues = {
  name: string
  description: string | null
  permissionIds: readonly string[]
}

function createCustomRoleKey(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "ROLE"
  return `CUSTOM_${slug}_${randomUUID().slice(0, 8).toUpperCase()}`
}

async function assertUniqueRoleName(
  transaction: Prisma.TransactionClient,
  name: string,
  excludedRoleId?: string
) {
  const conflictingRole = await transaction.role.findFirst({
    where: {
      ...(excludedRoleId ? { id: { not: excludedRoleId } } : {}),
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true, key: true },
  })
  if (conflictingRole) {
    throw new AccessControlWorkflowError("A role with this name already exists.")
  }
}

async function getActivePermissions(
  transaction: Prisma.TransactionClient,
  permissionIds: readonly string[]
) {
  const permissions = await transaction.permission.findMany({
    where: { id: { in: [...permissionIds] }, isActive: true },
    select: { id: true, key: true },
    orderBy: { id: "asc" },
  })
  if (permissions.length !== permissionIds.length) {
    throw new AccessControlWorkflowError(
      "One or more selected permissions are unavailable. Refresh and try again."
    )
  }
  return permissions
}

export async function createCustomRole(values: CustomRoleValues, actingUserId: string) {
  return prisma.$transaction(
    async (transaction) => {
      await assertUniqueRoleName(transaction, values.name)
      const permissions = await getActivePermissions(
        transaction,
        values.permissionIds
      )

      const role = await transaction.role.create({
        data: {
          key: createCustomRoleKey(values.name),
          name: values.name,
          description: values.description,
          isSystem: false,
          isActive: true,
          rolePermissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
        select: { id: true, key: true },
      })
      const correlationId = createAuditCorrelationId()
      await writeSecurityAuditEvent(
        {
          eventType: "auth.role.created",
          outcome: "SUCCESS",
          actorUserId: actingUserId,
          targetType: "ROLE",
          targetId: role.id,
          correlationId,
          metadata: { roleKey: role.key },
        },
        transaction
      )
      for (const permission of permissions) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.role.permission_added",
            outcome: "SUCCESS",
            actorUserId: actingUserId,
            targetType: "ROLE",
            targetId: role.id,
            correlationId,
            metadata: { roleKey: role.key, permissionKey: permission.key },
          },
          transaction
        )
      }
      return role
    },
    { isolationLevel: "Serializable" }
  )
}

export async function updateCustomRole(
  roleId: string,
  values: CustomRoleValues,
  actingUserId: string,
  reason: string
) {
  return prisma.$transaction(
    async (transaction) => {
      const role = await transaction.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          key: true,
          isSystem: true,
          isActive: true,
          name: true,
          description: true,
          rolePermissions: {
            select: { permissionId: true, permission: { select: { key: true } } },
          },
          userRoles: {
            select: { userId: true, user: { select: { authVersion: true } } },
          },
        },
      })
      if (!role) throw new AccessControlWorkflowError("The role no longer exists.")
      if (role.isSystem) {
        throw new AccessControlWorkflowError(
          "Standard roles are locked. Duplicate this role to customize it."
        )
      }

      await assertUniqueRoleName(transaction, values.name, roleId)
      const permissions = await getActivePermissions(
        transaction,
        values.permissionIds
      )
      const permissionIds = permissions.map((permission) => permission.id)
      const currentPermissionIds = new Set(
        role.rolePermissions.map((grant) => grant.permissionId)
      )
      const nextPermissionIds = new Set(permissionIds)
      const permissionsChanged =
        currentPermissionIds.size !== nextPermissionIds.size ||
        [...currentPermissionIds].some((permissionId) => !nextPermissionIds.has(permissionId))
      const detailsChanged =
        role.name !== values.name || role.description !== values.description

      if (!permissionsChanged && !detailsChanged) {
        return { id: role.id, changed: false, affectedUserIds: [] as string[] }
      }

      if (permissionsChanged) {
        await transaction.rolePermission.deleteMany({ where: { roleId } })
        await transaction.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        })
      }
      await transaction.role.update({
        where: { id: roleId },
        data: { name: values.name, description: values.description },
      })

      if (permissionsChanged && role.isActive) {
        await transaction.user.updateMany({
          where: { roleAssignments: { some: { roleId } } },
          data: { authVersion: { increment: 1 } },
        })
      }

      const correlationId = createAuditCorrelationId()
      const changedFields = [
        ...(role.name !== values.name ? ["name"] : []),
        ...(role.description !== values.description ? ["description"] : []),
        ...(permissionsChanged ? ["permissions"] : []),
      ]
      await writeSecurityAuditEvent(
        {
          eventType: "auth.role.updated",
          outcome: "SUCCESS",
          actorUserId: actingUserId,
          targetType: "ROLE",
          targetId: role.id,
          correlationId,
          metadata: { roleKey: role.key, changedFields, reason },
        },
        transaction
      )
      if (permissionsChanged) {
        const currentPermissionById = new Map(
          role.rolePermissions.map((grant) => [grant.permissionId, grant.permission.key])
        )
        const nextPermissionById = new Map(
          permissions.map((permission) => [permission.id, permission.key])
        )
        for (const permissionId of currentPermissionIds) {
          if (nextPermissionIds.has(permissionId)) continue
          await writeSecurityAuditEvent(
            {
              eventType: "auth.role.permission_removed",
              outcome: "SUCCESS",
              actorUserId: actingUserId,
              targetType: "ROLE",
              targetId: role.id,
              correlationId,
              metadata: {
                roleKey: role.key,
                permissionKey: currentPermissionById.get(permissionId) ?? "UNKNOWN",
                reason,
              },
            },
            transaction
          )
        }
        for (const permissionId of nextPermissionIds) {
          if (currentPermissionIds.has(permissionId)) continue
          await writeSecurityAuditEvent(
            {
              eventType: "auth.role.permission_added",
              outcome: "SUCCESS",
              actorUserId: actingUserId,
              targetType: "ROLE",
              targetId: role.id,
              correlationId,
              metadata: {
                roleKey: role.key,
                permissionKey: nextPermissionById.get(permissionId) ?? "UNKNOWN",
                reason,
              },
            },
            transaction
          )
        }
      }
      if (permissionsChanged && role.isActive) {
        for (const assignment of role.userRoles) {
          await writeSecurityAuditEvent(
            {
              eventType: "auth.session.revoked",
              outcome: "SUCCESS",
              actorUserId: actingUserId,
              targetType: "USER",
              targetId: assignment.userId,
              correlationId,
              metadata: {
                cause: "ROLE_PERMISSIONS_CHANGED",
                previousAuthVersion: assignment.user.authVersion,
                nextAuthVersion: assignment.user.authVersion + 1,
              },
            },
            transaction
          )
        }
      }

      return {
        id: role.id,
        changed: true,
        affectedUserIds: permissionsChanged && role.isActive
          ? role.userRoles.map((assignment) => assignment.userId)
          : [],
      }
    },
    { isolationLevel: "Serializable" }
  )
}

export async function setCustomRoleActive(
  roleId: string,
  isActive: boolean,
  actingUserId: string,
  reason: string
) {
  return prisma.$transaction(
    async (transaction) => {
      const role = await transaction.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          key: true,
          isSystem: true,
          isActive: true,
          _count: { select: { userRoles: true, rolePermissions: true } },
          userRoles: {
            select: { userId: true, user: { select: { authVersion: true } } },
          },
        },
      })
      if (!role) throw new AccessControlWorkflowError("The role no longer exists.")
      if (role.isSystem) {
        throw new AccessControlWorkflowError("Standard roles cannot be archived or reactivated.")
      }
      if (role.isActive === isActive) {
        return { id: role.id, changed: false, affectedUserIds: [] as string[] }
      }
      if (!isActive && role._count.userRoles > 0) {
        throw new AccessControlWorkflowError(
          "Remove this role from every assigned user before archiving it."
        )
      }
      if (isActive && role._count.rolePermissions === 0) {
        throw new AccessControlWorkflowError(
          "Add at least one permission before reactivating this role."
        )
      }

      await transaction.role.update({
        where: { id: roleId },
        data: { isActive },
      })
      await transaction.user.updateMany({
        where: { roleAssignments: { some: { roleId } } },
        data: { authVersion: { increment: 1 } },
      })

      const correlationId = createAuditCorrelationId()
      await writeSecurityAuditEvent(
        {
          eventType: "auth.role.updated",
          outcome: "SUCCESS",
          actorUserId: actingUserId,
          targetType: "ROLE",
          targetId: role.id,
          correlationId,
          metadata: {
            roleKey: role.key,
            changedFields: ["isActive"],
            isActive,
            reason,
          },
        },
        transaction
      )
      for (const assignment of role.userRoles) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.session.revoked",
            outcome: "SUCCESS",
            actorUserId: actingUserId,
            targetType: "USER",
            targetId: assignment.userId,
            correlationId,
            metadata: {
              cause: "ROLE_STATUS_CHANGED",
              previousAuthVersion: assignment.user.authVersion,
              nextAuthVersion: assignment.user.authVersion + 1,
            },
          },
          transaction
        )
      }

      return {
        id: role.id,
        changed: true,
        affectedUserIds: role.userRoles.map((assignment) => assignment.userId),
      }
    },
    { isolationLevel: "Serializable" }
  )
}
