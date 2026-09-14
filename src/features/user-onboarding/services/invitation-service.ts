import "server-only"

import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import {
  createAuditCorrelationId,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"
import { INVITATION_TTL_HOURS } from "../types/user-onboarding-schema"

export class InvitationWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvitationWorkflowError"
  }
}

const INVALID_INVITATION_MESSAGE =
  "This activation link is invalid, expired, or has already been used."

function generateInvitationSecret() {
  return randomBytes(32).toString("base64url")
}

function hashInvitationSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex")
}

function invitationExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000)
}

function activationPath(secret: string) {
  return `/activate-account/${encodeURIComponent(secret)}`
}

export async function createInvitedUser(
  input: { name: string; email: string; roleIds: readonly string[] },
  createdById: string
) {
  const secret = generateInvitationSecret()
  const tokenHash = hashInvitationSecret(secret)
  const expiresAt = invitationExpiry()
  const correlationId = createAuditCorrelationId()

  const user = await prisma.$transaction(
    async (transaction) => {
      const [existingUser, roles] = await Promise.all([
        transaction.user.findUnique({
          where: { normalizedEmail: input.email },
          select: { id: true },
        }),
        transaction.role.findMany({
          where: { id: { in: [...input.roleIds] }, isActive: true },
          select: { id: true, key: true },
          orderBy: { key: "asc" },
        }),
      ])

      if (existingUser) {
        throw new InvitationWorkflowError("A user with this email already exists.")
      }
      if (roles.length !== input.roleIds.length) {
        throw new InvitationWorkflowError(
          "One or more selected roles are unavailable. Refresh and try again."
        )
      }

      const createdUser = await transaction.user.create({
        data: {
          name: input.name,
          email: input.email,
          normalizedEmail: input.email,
          password: null,
          role: roles[0].key,
          status: "INVITED",
          roleAssignments: {
            create: roles.map((role) => ({
              roleId: role.id,
              assignedById: createdById,
            })),
          },
          invitations: {
            create: {
              tokenHash,
              expiresAt,
              createdById,
            },
          },
        },
        select: { id: true },
      })
      await writeSecurityAuditEvent(
        {
          eventType: "auth.user.created",
          outcome: "SUCCESS",
          actorUserId: createdById,
          targetType: "USER",
          targetId: createdUser.id,
          correlationId,
          metadata: { status: "INVITED" },
        },
        transaction
      )
      for (const role of roles) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.role.assigned",
            outcome: "SUCCESS",
            actorUserId: createdById,
            targetType: "USER",
            targetId: createdUser.id,
            correlationId,
            metadata: { roleKey: role.key },
          },
          transaction
        )
      }
      await writeSecurityAuditEvent(
        {
          eventType: "auth.invitation.created",
          outcome: "SUCCESS",
          actorUserId: createdById,
          targetType: "USER",
          targetId: createdUser.id,
          correlationId,
          metadata: {
            operation: "INITIAL",
            expiresAt: expiresAt.toISOString(),
          },
        },
        transaction
      )
      return createdUser
    },
    { isolationLevel: "Serializable" }
  )

  return {
    userId: user.id,
    activationPath: activationPath(secret),
    expiresAt,
  }
}

export async function reissueUserInvitation(
  userId: string,
  createdById: string,
  reason: string
) {
  const secret = generateInvitationSecret()
  const tokenHash = hashInvitationSecret(secret)
  const expiresAt = invitationExpiry()
  const now = new Date()
  const correlationId = createAuditCorrelationId()

  await prisma.$transaction(
    async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, password: true },
      })

      if (!user) throw new InvitationWorkflowError("The user no longer exists.")
      const canRestoreCancelledInvitation = user.status === "DISABLED" && !user.password
      if (user.status !== "INVITED" && !canRestoreCancelledInvitation) {
        throw new InvitationWorkflowError(
          "Activation links can only be issued for invited accounts."
        )
      }

      const revokedInvitations = await transaction.userInvitation.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      })
      if (revokedInvitations.count > 0) {
        await writeSecurityAuditEvent(
          {
            eventType: "auth.invitation.revoked",
            outcome: "SUCCESS",
            actorUserId: createdById,
            targetType: "USER",
            targetId: userId,
            correlationId,
            metadata: { operation: "REISSUED", reason },
          },
          transaction
        )
      }
      await transaction.userInvitation.create({
        data: { userId, tokenHash, expiresAt, createdById },
      })
      if (canRestoreCancelledInvitation) {
        await transaction.user.update({
          where: { id: userId },
          data: { status: "INVITED", authVersion: { increment: 1 } },
        })
      }
      await writeSecurityAuditEvent(
        {
          eventType: "auth.invitation.created",
          outcome: "SUCCESS",
          actorUserId: createdById,
          targetType: "USER",
          targetId: userId,
          correlationId,
          metadata: {
            operation: "REISSUED",
            expiresAt: expiresAt.toISOString(),
            reason,
          },
        },
        transaction
      )
    },
    { isolationLevel: "Serializable" }
  )

  return { activationPath: activationPath(secret), expiresAt }
}

export async function getInvitationPreview(secret: string) {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashInvitationSecret(secret) },
    select: {
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      user: { select: { name: true, email: true, status: true } },
    },
  })

  const valid = Boolean(
    invitation &&
      !invitation.usedAt &&
      !invitation.revokedAt &&
      invitation.expiresAt.getTime() > Date.now() &&
      invitation.user.status === "INVITED"
  )

  if (!invitation || !valid) return { valid: false as const }
  return {
    valid: true as const,
    name: invitation.user.name,
    email: invitation.user.email,
    expiresAt: invitation.expiresAt,
  }
}

export async function activateInvitedAccount(secret: string, password: string) {
  const preview = await getInvitationPreview(secret)
  if (!preview.valid) {
    throw new InvitationWorkflowError(INVALID_INVITATION_MESSAGE)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const tokenHash = hashInvitationSecret(secret)
  const now = new Date()

  await prisma.$transaction(
    async (transaction) => {
      const invitation = await transaction.userInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          user: { select: { status: true } },
        },
      })

      if (
        !invitation ||
        invitation.usedAt ||
        invitation.revokedAt ||
        invitation.expiresAt.getTime() <= now.getTime() ||
        invitation.user.status !== "INVITED"
      ) {
        throw new InvitationWorkflowError(INVALID_INVITATION_MESSAGE)
      }

      const consumed = await transaction.userInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) {
        throw new InvitationWorkflowError(INVALID_INVITATION_MESSAGE)
      }

      const activated = await transaction.user.updateMany({
        where: { id: invitation.userId, status: "INVITED" },
        data: {
          password: passwordHash,
          status: "ACTIVE",
          authVersion: { increment: 1 },
          updatedAt: now,
        },
      })
      if (activated.count !== 1) {
        throw new InvitationWorkflowError(INVALID_INVITATION_MESSAGE)
      }

      await transaction.userInvitation.updateMany({
        where: {
          userId: invitation.userId,
          id: { not: invitation.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      })
      await writeSecurityAuditEvent(
        {
          eventType: "auth.invitation.accepted",
          outcome: "SUCCESS",
          actorUserId: invitation.userId,
          targetType: "USER",
          targetId: invitation.userId,
        },
        transaction
      )
    },
    { isolationLevel: "Serializable" }
  )
}
