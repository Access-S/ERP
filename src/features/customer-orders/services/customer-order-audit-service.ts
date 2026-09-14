import "server-only"

import { randomUUID } from "node:crypto"
import type { AuditOutcome, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  sanitizeCustomerOrderAuditMetadata,
  type CustomerOrderAuditEventType,
} from "./customer-order-audit-policy"

type BusinessAuditWriteClient = Pick<Prisma.TransactionClient, "businessAuditEvent">

export type WriteCustomerOrderAuditEventInput = {
  eventType: CustomerOrderAuditEventType
  outcome: AuditOutcome
  actorUserId?: string | null
  actorEmailSnapshot?: string | null
  targetType: "CUSTOMER_ORDER" | "CUSTOMER_ORDER_RELEASE" | "CUSTOMER_ORDER_AMENDMENT"
  targetId: string
  correlationId?: string
  metadata?: Readonly<Record<string, unknown>>
}

function bounded(value: string | null | undefined, maximum: number): string | null {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, maximum) : null
}

function requiredBounded(value: string, maximum: number, field: string): string {
  const normalized = bounded(value, maximum)
  if (!normalized) throw new TypeError(`${field} is required.`)
  return normalized
}

export function createBusinessCorrelationId(): string {
  return randomUUID()
}

export async function writeCustomerOrderAuditEvent(
  input: WriteCustomerOrderAuditEventInput,
  client: BusinessAuditWriteClient = prisma
) {
  return client.businessAuditEvent.create({
    data: {
      eventType: input.eventType,
      outcome: input.outcome,
      actorUserId: input.actorUserId ?? null,
      actorEmailSnapshot: bounded(input.actorEmailSnapshot?.toLowerCase(), 254),
      targetType: input.targetType,
      targetId: requiredBounded(input.targetId, 128, "Audit target ID"),
      correlationId: input.correlationId ?? createBusinessCorrelationId(),
      metadata: sanitizeCustomerOrderAuditMetadata(input.eventType, input.metadata),
    },
    select: { id: true, correlationId: true },
  })
}
