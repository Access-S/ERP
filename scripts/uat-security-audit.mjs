import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import {
  SECURITY_AUDIT_EVENT_TYPES,
  sanitizeAuditMetadata,
} from "../src/features/security-audit/services/audit-policy.ts"

const prisma = new PrismaClient()
const rollback = new Error("ROLLBACK_SECURITY_AUDIT_UAT")
const mutationAllowed = new Error("AUDIT_MUTATION_WAS_ALLOWED")

async function assertMutationBlocked(operation) {
  let blocked = false
  try {
    await prisma.$transaction(async (transaction) => {
      const event = await transaction.securityAuditEvent.create({
        data: {
          eventType: "auth.audit.viewed",
          outcome: "SUCCESS",
          correlationId: randomUUID(),
          metadata: {},
        },
        select: { id: true },
      })
      await operation(transaction, event.id)
      throw mutationAllowed
    })
  } catch (error) {
    if (error === mutationAllowed) throw error
    blocked = String(error?.message ?? error).includes("append-only")
  }
  assert.equal(blocked, true, "database trigger must reject audit UPDATE and DELETE")
}

async function main() {
  let checks = 0

  assert.equal(
    new Set(SECURITY_AUDIT_EVENT_TYPES).size,
    SECURITY_AUDIT_EVENT_TYPES.length,
    "event type catalogue must not contain duplicates"
  )
  checks += 1

  const sanitized = sanitizeAuditMetadata("auth.invitation.created", {
    operation: "INITIAL",
    expiresAt: "2026-09-14T00:00:00.000Z",
    password: "must-never-be-stored",
    tokenHash: "must-never-be-stored",
    arbitrary: "must-never-be-stored",
  })
  assert.deepEqual(sanitized, {
    operation: "INITIAL",
    expiresAt: "2026-09-14T00:00:00.000Z",
  })
  assert.equal(JSON.stringify(sanitized).includes("must-never-be-stored"), false)
  checks += 2

  const passwordResetMetadata = sanitizeAuditMetadata("auth.password_reset.requested", {
    operation: "ADMIN_LINK",
    expiresAt: "2026-09-13T03:00:00.000Z",
    password: "must-never-be-stored",
    resetToken: "must-never-be-stored",
    tokenHash: "must-never-be-stored",
  })
  assert.deepEqual(passwordResetMetadata, {
    operation: "ADMIN_LINK",
    expiresAt: "2026-09-13T03:00:00.000Z",
  })
  assert.equal(
    JSON.stringify(passwordResetMetadata).includes("must-never-be-stored"),
    false
  )
  checks += 2

  const truncated = sanitizeAuditMetadata("auth.role.updated", {
    roleKey: "R".repeat(300),
    changedFields: Array.from({ length: 60 }, (_, index) => `field-${index}`),
  })
  assert.equal(truncated.roleKey.length, 256)
  assert.equal(truncated.changedFields.length, 50)
  checks += 2

  assert.deepEqual(
    SYSTEM_ROLES
      .filter((role) => role.permissions.includes("admin.audit.view"))
      .map((role) => role.key),
    ["SYSTEM_ADMIN"],
    "only the technical System Administrator views audit history by default"
  )
  checks += 1

  const baseline = await prisma.securityAuditEvent.count()
  try {
    await prisma.$transaction(async (transaction) => {
      const event = await transaction.securityAuditEvent.create({
        data: {
          eventType: "auth.invitation.created",
          outcome: "SUCCESS",
          targetType: "USER",
          targetId: randomUUID(),
          correlationId: randomUUID(),
          metadata: sanitized,
        },
      })
      assert.equal(event.eventType, "auth.invitation.created")
      assert.equal(event.outcome, "SUCCESS")
      assert.deepEqual(event.metadata, sanitized)
      assert.equal(JSON.stringify(event.metadata).includes("password"), false)
      checks += 4
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }
  assert.equal(await prisma.securityAuditEvent.count(), baseline)
  checks += 1

  await assertMutationBlocked((transaction, eventId) =>
    transaction.securityAuditEvent.update({
      where: { id: eventId },
      data: { reasonCode: "TAMPERED" },
    })
  )
  checks += 1

  await assertMutationBlocked((transaction, eventId) =>
    transaction.securityAuditEvent.delete({ where: { id: eventId } })
  )
  checks += 1

  assert.equal(
    await prisma.securityAuditEvent.count(),
    baseline,
    "audit UAT must not leave test records behind"
  )
  checks += 1

  console.log(
    `Security audit UAT passed (${checks} checks; database records rolled back).`
  )
}

main()
  .catch((error) => {
    console.error("Security audit UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
