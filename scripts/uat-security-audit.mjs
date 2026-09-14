import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { SYSTEM_ROLES } from "../src/features/auth/config/authorization-registry.ts"
import {
  SECURITY_AUDIT_EVENT_TYPES,
  sanitizeAuditMetadata,
} from "../src/features/security-audit/services/audit-policy.ts"
import {
  classifySecurityAuditEvent,
  getSecurityAuditSeverityPriority,
  SECURITY_AUDIT_CATEGORIES,
  SECURITY_AUDIT_EVENT_REGISTRY,
} from "../src/features/security-audit/services/audit-registry.ts"

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

  assert.deepEqual(
    Object.keys(SECURITY_AUDIT_EVENT_REGISTRY).sort(),
    [...SECURITY_AUDIT_EVENT_TYPES].sort(),
    "every event type must have exactly one classification"
  )
  assert.equal(
    Object.values(SECURITY_AUDIT_EVENT_REGISTRY).every((definition) =>
      SECURITY_AUDIT_CATEGORIES.includes(definition.category)
    ),
    true,
    "every event classification must use a registered category"
  )
  assert.equal(
    classifySecurityAuditEvent({
      eventType: "auth.role.assigned",
      outcome: "SUCCESS",
      metadata: { roleKey: "SYSTEM_ADMIN" },
    }).severity,
    "CRITICAL",
    "System Administrator assignment must be critical"
  )
  assert.equal(
    classifySecurityAuditEvent({
      eventType: "auth.bootstrap_admin.created",
      outcome: "SUCCESS",
      metadata: { environment: "development" },
    }).severity,
    "CRITICAL",
    "bootstrap administrator creation must be critical"
  )
  assert.equal(
    classifySecurityAuditEvent({
      eventType: "auth.login.succeeded",
      outcome: "FAILURE",
      metadata: {},
    }).severity,
    "WARNING",
    "failed outcomes must be elevated for administrator attention"
  )
  assert.ok(
    getSecurityAuditSeverityPriority("CRITICAL") >
      getSecurityAuditSeverityPriority("WARNING"),
    "critical events must sort ahead of warnings"
  )
  assert.deepEqual(
    classifySecurityAuditEvent({
      eventType: "auth.future.event",
      outcome: "SUCCESS",
      metadata: {},
    }),
    {
      category: "SECURITY_OVERSIGHT",
      severity: "WARNING",
      label: "Unclassified security event",
      description:
        "A stored event is not yet present in this application's security registry.",
    },
    "an unknown stored event must remain visible without breaking monitoring"
  )
  checks += 7

  const sanitized = sanitizeAuditMetadata("auth.invitation.created", {
    operation: "REISSUED",
    expiresAt: "2026-09-14T00:00:00.000Z",
    reason: "The intended recipient lost the original link.",
    password: "must-never-be-stored",
    tokenHash: "must-never-be-stored",
    arbitrary: "must-never-be-stored",
  })
  assert.deepEqual(sanitized, {
    operation: "REISSUED",
    expiresAt: "2026-09-14T00:00:00.000Z",
    reason: "The intended recipient lost the original link.",
  })
  assert.equal(JSON.stringify(sanitized).includes("must-never-be-stored"), false)
  checks += 2

  const bootstrapMetadata = sanitizeAuditMetadata("auth.bootstrap_admin.created", {
    environment: "development",
    reason: "Create the first recoverable administrator.",
    password: "must-never-be-stored",
    databaseUrl: "must-never-be-stored",
  })
  assert.deepEqual(bootstrapMetadata, {
    environment: "development",
    reason: "Create the first recoverable administrator.",
  })
  assert.equal(JSON.stringify(bootstrapMetadata).includes("must-never-be-stored"), false)
  checks += 2

  const passwordResetMetadata = sanitizeAuditMetadata("auth.password_reset.requested", {
    operation: "ADMIN_LINK",
    expiresAt: "2026-09-13T03:00:00.000Z",
    reason: "Identity verified through the approved support process.",
    password: "must-never-be-stored",
    resetToken: "must-never-be-stored",
    tokenHash: "must-never-be-stored",
  })
  assert.deepEqual(passwordResetMetadata, {
    operation: "ADMIN_LINK",
    expiresAt: "2026-09-13T03:00:00.000Z",
    reason: "Identity verified through the approved support process.",
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
