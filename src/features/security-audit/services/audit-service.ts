import "server-only"

import { randomUUID } from "node:crypto"
import type { AuditOutcome, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  sanitizeAuditMetadata,
  type SecurityAuditEventType,
} from "./audit-policy"

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
  outcome?: AuditOutcome
  take?: number
}) {
  const events = await prisma.securityAuditEvent.findMany({
    where: {
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.outcome ? { outcome: filters.outcome } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(filters?.take ?? 100, 1), 200),
  })

  const actorIds = [
    ...new Set(
      events.flatMap((event) => (event.actorUserId ? [event.actorUserId] : []))
    ),
  ]
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const actorById = new Map(actors.map((actor) => [actor.id, actor]))

  return events.map((event) => ({
    ...event,
    actor: event.actorUserId ? actorById.get(event.actorUserId) ?? null : null,
  }))
}
