import "server-only"

import { randomUUID } from "node:crypto"
import type { AuditOutcome, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  sanitizeAuditMetadata,
  type SecurityAuditEventType,
} from "./audit-policy"
import {
  classifySecurityAuditEvent,
  getAuditEventTypesForCategory,
  getSecurityAuditSeverityPriority,
  SECURITY_AUDIT_CATEGORIES,
  type SecurityAuditCategory,
} from "./audit-registry"

type AuditWriteClient = Pick<Prisma.TransactionClient, "securityAuditEvent">

export type WriteSecurityAuditEventInput = {
  eventType: SecurityAuditEventType
  outcome: AuditOutcome
  actorUserId?: string | null
  actorEmailSnapshot?: string | null
  targetType?: string | null
  targetId?: string | null
  reasonCode?: string | null
  correlationId?: string
  metadata?: Readonly<Record<string, unknown>>
}

function bounded(value: string | null | undefined, maximum: number) {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, maximum) : null
}

export function createAuditCorrelationId() {
  return randomUUID()
}

export async function writeSecurityAuditEvent(
  input: WriteSecurityAuditEventInput,
  client: AuditWriteClient = prisma
) {
  return client.securityAuditEvent.create({
    data: {
      eventType: input.eventType,
      outcome: input.outcome,
      actorUserId: input.actorUserId ?? null,
      actorEmailSnapshot: bounded(
        input.actorEmailSnapshot?.toLowerCase(),
        254
      ),
      targetType: bounded(input.targetType?.toUpperCase(), 40),
      targetId: bounded(input.targetId, 128),
      reasonCode: bounded(input.reasonCode?.toUpperCase(), 80),
      correlationId: input.correlationId ?? createAuditCorrelationId(),
      metadata: sanitizeAuditMetadata(input.eventType, input.metadata),
    },
    select: { id: true, correlationId: true },
  })
}

export async function getSecurityAuditEvents(filters?: {
  eventType?: SecurityAuditEventType
  eventTypes?: readonly SecurityAuditEventType[]
  outcome?: AuditOutcome
  take?: number
}) {
  const events = await prisma.securityAuditEvent.findMany({
    where: {
      ...(filters?.eventType
        ? { eventType: filters.eventType }
        : filters?.eventTypes
          ? { eventType: { in: [...filters.eventTypes] } }
          : {}),
      ...(filters?.outcome ? { outcome: filters.outcome } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(filters?.take ?? 100, 1), 200),
  })

  const userIds = [
    ...new Set(
      events.flatMap((event) => [
        ...(event.actorUserId ? [event.actorUserId] : []),
        ...(event.targetType === "USER" && event.targetId ? [event.targetId] : []),
      ])
    ),
  ]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  return events.map((event) => ({
    ...event,
    actor: event.actorUserId ? userById.get(event.actorUserId) ?? null : null,
    targetUser:
      event.targetType === "USER" && event.targetId
        ? userById.get(event.targetId) ?? null
        : null,
  }))
}

export type SecurityAuditEventRecord = Awaited<
  ReturnType<typeof getSecurityAuditEvents>
>[number]

export async function getSecurityAuditDashboard() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const roleAndPermissionTypes = getAuditEventTypesForCategory("ROLES_PERMISSIONS")
  const passwordTypes: SecurityAuditEventType[] = [
    "auth.password.changed",
    "auth.password.change_failed",
    "auth.password_reset.requested",
    "auth.password_reset.completed",
    "auth.password_reset.failed",
  ]

  const [
    failedLogins,
    credentialEvents,
    accessDenials,
    privilegedChanges,
    sessionRevocations,
    ...categoryEvents
  ] = await Promise.all([
    prisma.securityAuditEvent.count({
      where: { eventType: "auth.login.failed", occurredAt: { gte: since } },
    }),
    prisma.securityAuditEvent.count({
      where: { eventType: { in: passwordTypes }, occurredAt: { gte: since } },
    }),
    prisma.securityAuditEvent.count({
      where: { eventType: "auth.access.denied", occurredAt: { gte: since } },
    }),
    prisma.securityAuditEvent.count({
      where: { eventType: { in: roleAndPermissionTypes }, occurredAt: { gte: since } },
    }),
    prisma.securityAuditEvent.count({
      where: { eventType: "auth.session.revoked", occurredAt: { gte: since } },
    }),
    ...SECURITY_AUDIT_CATEGORIES.map((category) =>
      getSecurityAuditEvents({
        eventTypes: getAuditEventTypesForCategory(category),
        take: 40,
      })
    ),
  ])

  return {
    since,
    indicators: {
      failedLogins,
      credentialEvents,
      accessDenials,
      privilegedChanges,
      sessionRevocations,
    },
    categories: Object.fromEntries(
      SECURITY_AUDIT_CATEGORIES.map((category, index) => [
        category,
        [...(categoryEvents[index] ?? [])]
          .sort((left, right) => {
            const severityDifference =
              getSecurityAuditSeverityPriority(classifySecurityAuditEvent(right).severity) -
              getSecurityAuditSeverityPriority(classifySecurityAuditEvent(left).severity)
            return severityDifference || right.occurredAt.getTime() - left.occurredAt.getTime()
          })
          .slice(0, 8),
      ])
    ) as Record<SecurityAuditCategory, SecurityAuditEventRecord[]>,
  }
}
