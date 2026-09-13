import "server-only"

import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import {
  createAuditCorrelationId,
  writeSecurityAuditEvent,
} from "@/features/security-audit/services/audit-service"
import { PASSWORD_RESET_TTL_HOURS } from "../types/password-management-schema"

export class PasswordWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PasswordWorkflowError"
  }
}

const INVALID_RESET_MESSAGE =
  "This password reset link is invalid, expired, or has already been used."

function generateResetSecret() {
  return randomBytes(32).toString("base64url")
}

function hashResetSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex")
}

function resetExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000)
}

function resetPath(secret: string) {
  return `/reset-password/${encodeURIComponent(secret)}`
}

async function recordPasswordFailure(input: {
  eventType: "auth.password.change_failed" | "auth.password_reset.failed"
  actorUserId?: string
  targetId?: string
  reasonCode: string
  operation: "SELF_SERVICE" | "ADMIN_LINK"
}) {
  try {
    await writeSecurityAuditEvent({
      eventType: input.eventType,
      outcome: "FAILURE",
      actorUserId: input.actorUserId,
      targetType: "USER",
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      metadata: { operation: input.operation },
    })
  } catch (error) {
    console.error("Password failure could not be audited", error)
  }
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, status: true, authVersion: true },
  })

  if (!user || user.status !== "ACTIVE" || !user.password) {
    await recordPasswordFailure({
      eventType: "auth.password.change_failed",
      actorUserId: userId,
      targetId: user?.id ?? userId,
      reasonCode: "ACCOUNT_UNAVAILABLE",
      operation: "SELF_SERVICE",
    })
    throw new PasswordWorkflowError("Your session is no longer valid. Sign in again.")
  }

  const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password)
  if (!currentPasswordMatches) {
    await recordPasswordFailure({
      eventType: "auth.password.change_failed",
      actorUserId: userId,
      targetId: userId,
      reasonCode: "INVALID_CURRENT_PASSWORD",
      operation: "SELF_SERVICE",
    })
    throw new PasswordWorkflowError("The current password is incorrect.")
  }

  const reusesCurrentPassword = await bcrypt.compare(newPassword, user.password)
  if (reusesCurrentPassword) {
    await recordPasswordFailure({
      eventType: "auth.password.change_failed",
      actorUserId: userId,
      targetId: userId,
      reasonCode: "PASSWORD_REUSED",
      operation: "SELF_SERVICE",
    })
    throw new PasswordWorkflowError("Choose a password different from your current password.")
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  const correlationId = createAuditCorrelationId()
  const nextAuthVersion = user.authVersion + 1

  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: {
        id: user.id,
        status: "ACTIVE",
        password: user.password,
        authVersion: user.authVersion,
      },
      data: {
        password: passwordHash,
        authVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    })
    if (updated.count !== 1) {
      throw new PasswordWorkflowError(
        "Your account changed while this request was being processed. Sign in and try again."
      )
    }

    await transaction.passwordResetToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await writeSecurityAuditEvent(
      {
        eventType: "auth.password.changed",
        outcome: "SUCCESS",
        actorUserId: userId,
        targetType: "USER",
        targetId: userId,
        correlationId,
        metadata: { operation: "SELF_SERVICE" },
      },
      transaction
    )
    await writeSecurityAuditEvent(
      {
        eventType: "auth.session.revoked",
        outcome: "SUCCESS",
        actorUserId: userId,
        targetType: "USER",
        targetId: userId,
        correlationId,
        metadata: {
          cause: "PASSWORD_CHANGED",
          previousAuthVersion: user.authVersion,
          nextAuthVersion,
        },
      },
      transaction
    )
  })
}

export async function createPasswordResetLink(userId: string, createdById: string) {
  const secret = generateResetSecret()
  const tokenHash = hashResetSecret(secret)
  const expiresAt = resetExpiry()
  const now = new Date()

  await prisma.$transaction(
    async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, password: true },
      })
      if (!user) throw new PasswordWorkflowError("The user no longer exists.")
      if (user.status !== "ACTIVE" || !user.password) {
        throw new PasswordWorkflowError(
          "Password reset links can only be issued for active accounts."
        )
      }

      await transaction.passwordResetToken.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      })
      await transaction.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt, createdById },
      })
      await writeSecurityAuditEvent(
        {
          eventType: "auth.password_reset.requested",
          outcome: "SUCCESS",
          actorUserId: createdById,
          targetType: "USER",
          targetId: userId,
          metadata: {
            operation: "ADMIN_LINK",
            expiresAt: expiresAt.toISOString(),
          },
        },
        transaction
      )
    },
    { isolationLevel: "Serializable" }
  )

  return { resetPath: resetPath(secret), expiresAt }
}

export async function getPasswordResetPreview(secret: string) {
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetSecret(secret) },
    select: {
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      user: { select: { name: true, email: true, status: true } },
    },
  })

  const valid = Boolean(
    reset &&
      !reset.usedAt &&
      !reset.revokedAt &&
      reset.expiresAt.getTime() > Date.now() &&
      reset.user.status === "ACTIVE"
  )
  if (!reset || !valid) return { valid: false as const }

  return {
    valid: true as const,
    name: reset.user.name,
    email: reset.user.email,
    expiresAt: reset.expiresAt,
  }
}

export async function resetPassword(secret: string, password: string) {
  const tokenHash = hashResetSecret(secret)
  const now = new Date()
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      user: {
        select: { password: true, status: true, authVersion: true },
      },
    },
  })

  if (
    !reset ||
    reset.usedAt ||
    reset.revokedAt ||
    reset.expiresAt.getTime() <= now.getTime() ||
    reset.user.status !== "ACTIVE" ||
    !reset.user.password
  ) {
    if (reset) {
      await recordPasswordFailure({
        eventType: "auth.password_reset.failed",
        targetId: reset.userId,
        reasonCode: "INVALID_OR_EXPIRED",
        operation: "ADMIN_LINK",
      })
    }
    throw new PasswordWorkflowError(INVALID_RESET_MESSAGE)
  }

  if (await bcrypt.compare(password, reset.user.password)) {
    await recordPasswordFailure({
      eventType: "auth.password_reset.failed",
      targetId: reset.userId,
      reasonCode: "PASSWORD_REUSED",
      operation: "ADMIN_LINK",
    })
    throw new PasswordWorkflowError("Choose a password different from your current password.")
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const correlationId = createAuditCorrelationId()
  const nextAuthVersion = reset.user.authVersion + 1

  await prisma.$transaction(
    async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: reset.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) throw new PasswordWorkflowError(INVALID_RESET_MESSAGE)

      const updated = await transaction.user.updateMany({
        where: {
          id: reset.userId,
          status: "ACTIVE",
          password: reset.user.password,
          authVersion: reset.user.authVersion,
        },
        data: {
          password: passwordHash,
          authVersion: { increment: 1 },
          updatedAt: now,
        },
      })
      if (updated.count !== 1) throw new PasswordWorkflowError(INVALID_RESET_MESSAGE)

      await transaction.passwordResetToken.updateMany({
        where: {
          userId: reset.userId,
          id: { not: reset.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      })
      await writeSecurityAuditEvent(
        {
          eventType: "auth.password_reset.completed",
          outcome: "SUCCESS",
          actorUserId: reset.userId,
          targetType: "USER",
          targetId: reset.userId,
          correlationId,
          metadata: { operation: "ADMIN_LINK" },
        },
        transaction
      )
      await writeSecurityAuditEvent(
        {
          eventType: "auth.session.revoked",
          outcome: "SUCCESS",
          actorUserId: reset.userId,
          targetType: "USER",
          targetId: reset.userId,
          correlationId,
          metadata: {
            cause: "PASSWORD_RESET",
            previousAuthVersion: reset.user.authVersion,
            nextAuthVersion,
          },
        },
        transaction
      )
    },
    { isolationLevel: "Serializable" }
  )
}
