import "server-only"

import type { UserStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  createAuditCorrelationId,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"
import {
  SYSTEM_ADMIN_ROLE_KEY,
  wouldRemoveLastRecoverableAdministrator,
} from "./access-control-policy"

export class AccessControlWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccessControlWorkflowError"
  }
}

const roleSummarySelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  isActive: true,
  rolePermissions: {
    where: { permission: { isActive: true } },
    select: {
      permission: {
        select: { id: true, key: true, module: true, description: true },
      },
    },
    orderBy: { permission: { key: "asc" as const } },
  },
  _count: { select: { userRoles: true } },
} as const

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  authVersion: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  invitations: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
    },
  },
  roleAssignments: {
    orderBy: { role: { name: "asc" as const } },
    select: {
      assignedAt: true,
      assignedBy: { select: { id: true, name: true } },
      role: { select: roleSummarySelect },
    },
  },
} as const

export async function getAccessControlOverview() {
  const [totalUsers, activeUsers, invitedUsers, restrictedUsers, activeRoles, customRoles] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "INVITED" } }),
      prisma.user.count({ where: { status: { in: ["SUSPENDED", "DISABLED"] } } }),
      prisma.role.count({ where: { isActive: true } }),
      prisma.role.count({ where: { isSystem: false } }),
    ])

  return { totalUsers, activeUsers, invitedUsers, restrictedUsers, activeRoles, customRoles }
}

export async function getAccessControlUsers() {
  return prisma.user.findMany({
    select: userSummarySelect,
    orderBy: [{ status: "asc" }, { name: "asc" }, { email: "asc" }],
  })
}

export async function getAccessControlUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userSummarySelect,
  })
}

export async function getUserCredentialState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  return user ? { hasPassword: Boolean(user.password) } : null
}

export async function getAccessControlRoles() {
  return prisma.role.findMany({
    select: roleSummarySelect,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  })
}

export async function getAccessControlRole(roleId: string) {
  return prisma.role.findUnique({
    where: { id: roleId },
    select: {
      ...roleSummarySelect,
      userRoles: {
        orderBy: { user: { name: "asc" } },
        select: {
          assignedAt: true,
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
    },
  })
}

export async function getPermissionCatalogue() {
  return prisma.permission.findMany({
    where: { isActive: true },
    select: { id: true, key: true, module: true, description: true },
    orderBy: [{ module: "asc" }, { key: "asc" }],
  })
}

async function countOtherActiveAdministrators(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  targetUserId: string
) {
  return transaction.user.count({
    where: {
      id: { not: targetUserId },
      status: "ACTIVE",
      roleAssignments: {
        some: {
          role: { key: SYSTEM_ADMIN_ROLE_KEY, isActive: true },
        },
      },
    },
  })
}

export async function replaceUserRoleAssignments(
  targetUserId: string,
  requestedRoleIds: readonly string[],
  assignedById: string
) {
  return prisma.$transaction(
    async (transaction) => {
      const [target, roles] = await Promise.all([
        transaction.user.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            status: true,
            authVersion: true,
            roleAssignments: {
              select: { role: { select: { id: true, key: true, isActive: true } } },
            },
          },
        }),
        transaction.role.findMany({
          where: { id: { in: [...requestedRoleIds] }, isActive: true },
          select: { id: true, key: true },
          orderBy: { key: "asc" },
        }),
      ])

      if (!target) throw new AccessControlWorkflowError("The user no longer exists.")
      if (roles.length !== requestedRoleIds.length) {
        throw new AccessControlWorkflowError(
          "One or more selected roles are unavailable. Refresh and try again."
        )
      }

      const currentRoleIds = target.roleAssignments.map(({ role }) => role.id)
      const nextRoleIds = roles.map((role) => role.id)
      const currentSet = new Set(currentRoleIds)
      const nextSet = new Set(nextRoleIds)
      const removedRoleIds = currentRoleIds.filter((roleId) => !nextSet.has(roleId))
      const addedRoleIds = nextRoleIds.filter((roleId) => !currentSet.has(roleId))

      if (removedRoleIds.length === 0 && addedRoleIds.length === 0) {
        return { changed: false }
      }

      const targetHasSystemAdmin = target.roleAssignments.some(
        ({ role }) => role.key === SYSTEM_ADMIN_ROLE_KEY && role.isActive
      )
      const targetWillHaveSystemAdmin = roles.some(
        (role) => role.key === SYSTEM_ADMIN_ROLE_KEY
      )

      if (target.status === "ACTIVE" && targetHasSystemAdmin && !targetWillHaveSystemAdmin) {
        const otherAdminCount = await countOtherActiveAdministrators(
          transaction,
          targetUserId
        )
        if (
          wouldRemoveLastRecoverableAdministrator({
            targetIsActive: true,
            targetHasSystemAdmin: true,
            targetWillBeActive: true,
            targetWillHaveSystemAdmin: false,
            otherActiveAdministratorCount: otherAdminCount,
          })
        ) {
          throw new AccessControlWorkflowError(
            "This is the last active System Administrator. Assign that role to another active user first."
          )
        }
      }

      if (removedRoleIds.length > 0) {
        await transaction.userRole.deleteMany({
          where: { userId: targetUserId, roleId: { in: removedRoleIds } },
        })
      }
      if (addedRoleIds.length > 0) {
        await transaction.userRole.createMany({
          data: addedRoleIds.map((roleId) => ({
            userId: targetUserId,
            roleId,
            assignedById,
          })),
        })
      }

      const currentLegacyRole = target.roleAssignments.find(({ role }) =>
        nextSet.has(role.id)
      )?.role.key
      const updatedUser = await transaction.user.update({
        where: { id: targetUserId },
        data: {
          role: currentLegacyRole ?? roles[0].key,
          authVersion: { increment: 1 },
        },
        select: { authVersion: true },
      })

      const correlationId = createAuditCorrelationId()
      const currentRoleById = new Map(
        target.roleAssignments.map(({ role }) => [role.id, role.key])
      )
      const nextRoleById = new Map(roles.map((role) => [role.id, role.key]))
      for (const roleId of removedRoleIds) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.role.revoked",
            outcome: "SUCCESS",
            actorUserId: assignedById,
            targetType: "USER",
            targetId: targetUserId,
            correlationId,
            metadata: { roleKey: currentRoleById.get(roleId) ?? "UNKNOWN" },
          },
          transaction
        )
      }
      for (const roleId of addedRoleIds) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.role.assigned",
            outcome: "SUCCESS",
            actorUserId: assignedById,
            targetType: "USER",
            targetId: targetUserId,
            correlationId,
            metadata: { roleKey: nextRoleById.get(roleId) ?? "UNKNOWN" },
          },
          transaction
        )
      }
      if (target.status !== "INVITED") {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.session.revoked",
            outcome: "SUCCESS",
            actorUserId: assignedById,
            targetType: "USER",
            targetId: targetUserId,
            correlationId,
            metadata: {
              cause: "ROLE_ASSIGNMENTS_CHANGED",
              previousAuthVersion: target.authVersion,
              nextAuthVersion: updatedUser.authVersion,
            },
          },
          transaction
        )
      }

      return { changed: true }
    },
    { isolationLevel: "Serializable" }
  )
}

export async function changeUserStatus(
  targetUserId: string,
  nextStatus: Exclude<UserStatus, "INVITED">,
  actingUserId: string
) {
  if (targetUserId === actingUserId) {
    throw new AccessControlWorkflowError(
      "You cannot change your own account status. Ask another administrator."
    )
  }

  return prisma.$transaction(
    async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          status: true,
          authVersion: true,
          roleAssignments: {
            select: { role: { select: { key: true, isActive: true } } },
          },
        },
      })
      if (!target) throw new AccessControlWorkflowError("The user no longer exists.")
      if (target.status === nextStatus) return { changed: false }

      const targetHasSystemAdmin = target.roleAssignments.some(
        ({ role }) => role.key === SYSTEM_ADMIN_ROLE_KEY && role.isActive
      )
      if (target.status === "ACTIVE" && nextStatus !== "ACTIVE" && targetHasSystemAdmin) {
        const otherAdminCount = await countOtherActiveAdministrators(
          transaction,
          targetUserId
        )
        if (
          wouldRemoveLastRecoverableAdministrator({
            targetIsActive: true,
            targetHasSystemAdmin: true,
            targetWillBeActive: false,
            targetWillHaveSystemAdmin: true,
            otherActiveAdministratorCount: otherAdminCount,
          })
        ) {
          throw new AccessControlWorkflowError(
            "This is the last active System Administrator and cannot be suspended or disabled."
          )
        }
      }

      const updatedUser = await transaction.user.update({
        where: { id: targetUserId },
        data: { status: nextStatus, authVersion: { increment: 1 } },
        select: { authVersion: true },
      })
      const correlationId = createAuditCorrelationId()
      const statusEventType =
        nextStatus === "ACTIVE"
          ? "auth.user.reactivated"
          : nextStatus === "SUSPENDED"
            ? "auth.user.suspended"
            : "auth.user.disabled"
      await writeSecurityAuditEvent(
        {
          eventType: statusEventType,
          outcome: "SUCCESS",
          actorUserId: actingUserId,
          targetType: "USER",
          targetId: targetUserId,
          correlationId,
          metadata: { previousStatus: target.status, nextStatus },
        },
        transaction
      )
      if (target.status !== "INVITED") {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.session.revoked",
            outcome: "SUCCESS",
            actorUserId: actingUserId,
            targetType: "USER",
            targetId: targetUserId,
            correlationId,
            metadata: {
              cause: "ACCOUNT_STATUS_CHANGED",
              previousAuthVersion: target.authVersion,
              nextAuthVersion: updatedUser.authVersion,
            },
          },
          transaction
        )
      }
      if (target.status === "INVITED" && nextStatus === "DISABLED") {
        const revokedInvitations = await transaction.userInvitation.updateMany({
          where: { userId: targetUserId, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        if (revokedInvitations.count > 0) {
          await writeSecurityAuditEvent(
            {
              eventType: "auth.invitation.revoked",
              outcome: "SUCCESS",
              actorUserId: actingUserId,
              targetType: "USER",
              targetId: targetUserId,
              correlationId,
              metadata: { operation: "CANCELLED" },
            },
            transaction
          )
        }
      }
      return { changed: true }
    },
    { isolationLevel: "Serializable" }
  )
}
