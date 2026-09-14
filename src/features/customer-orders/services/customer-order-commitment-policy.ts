import { Prisma } from "@prisma/client"

import { calculateBlanketBalance } from "./blanket-balance.ts"

const COMMITTED_RELEASE_STATUSES = [
  "READY_FOR_PLANNING",
  "PLANNING",
  "PLANNED",
  "IN_PRODUCTION",
  "COMPLETED",
] as const

export type CustomerOrderCommitmentErrorCode =
  | "RELEASE_NOT_FOUND"
  | "RELEASE_NOT_EDITABLE"
  | "RELEASE_NOT_VALID"
  | "ORDER_NOT_OPEN"
  | "BLANKET_NOT_ACTIVE"
  | "BLANKET_OUTSIDE_VALIDITY"
  | "BLANKET_BALANCE_EXCEEDED"

export class CustomerOrderCommitmentError extends Error {
  readonly code: CustomerOrderCommitmentErrorCode

  constructor(code: CustomerOrderCommitmentErrorCode, message: string) {
    super(message)
    this.name = "CustomerOrderCommitmentError"
    this.code = code
  }
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function hasValidationIssues(value: Prisma.JsonValue): boolean {
  return !Array.isArray(value) || value.length > 0
}

export async function commitCustomerOrderReleaseInTransaction(
  tx: Prisma.TransactionClient,
  releaseId: string,
  now: Date = new Date()
) {
  const initialRelease = await tx.customerOrderRelease.findUnique({
    where: { id: releaseId },
    select: { customerPurchaseOrderId: true },
  })
  if (!initialRelease) {
    throw new CustomerOrderCommitmentError("RELEASE_NOT_FOUND", "Customer Order release was not found.")
  }

  // Lock the common parent so all commitments against one blanket serialize,
  // even when the transactions are updating different release rows.
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "customer_purchase_orders"
    WHERE "id" = ${initialRelease.customerPurchaseOrderId}::uuid
    FOR UPDATE
  `

  const release = await tx.customerOrderRelease.findUniqueOrThrow({
    where: { id: releaseId },
    include: {
      customerPurchaseOrder: { include: { amendments: { select: { valueDelta: true } } } },
      lines: { select: { validationStatus: true } },
    },
  })

  if (release.status === "READY_FOR_PLANNING" && release.committedValue && release.committedAt) {
    return release
  }
  if (release.status !== "DRAFT" && release.status !== "PO_CHECK") {
    throw new CustomerOrderCommitmentError(
      "RELEASE_NOT_EDITABLE",
      "Only a draft or PO Check release can become ready for planning."
    )
  }
  if (
    !release.expectedNetTotal ||
    !release.expectedNetTotal.greaterThan(0) ||
    release.lines.length === 0 ||
    release.lines.some((line) => line.validationStatus !== "VALID") ||
    hasValidationIssues(release.validationIssues)
  ) {
    throw new CustomerOrderCommitmentError(
      "RELEASE_NOT_VALID",
      "The release still has blocking validation issues."
    )
  }

  const order = release.customerPurchaseOrder
  if (
    order.type === "STANDARD" &&
    order.status !== "DRAFT" &&
    order.status !== "PO_CHECK" &&
    order.status !== "ACTIVE"
  ) {
    throw new CustomerOrderCommitmentError(
      "ORDER_NOT_OPEN",
      "The customer PO is no longer open for planning."
    )
  }

  let nextOrderStatus: "ACTIVE" | "EXHAUSTED" = "ACTIVE"
  if (order.type === "BLANKET") {
    if (order.status !== "ACTIVE") {
      throw new CustomerOrderCommitmentError("BLANKET_NOT_ACTIVE", "The blanket PO is not active.")
    }
    const today = dateOnly(now)
    if (!order.validFrom || !order.validTo || today < dateOnly(order.validFrom) || today > dateOnly(order.validTo)) {
      throw new CustomerOrderCommitmentError(
        "BLANKET_OUTSIDE_VALIDITY",
        "The blanket PO is outside its validity period."
      )
    }

    const otherCommitments = await tx.customerOrderRelease.findMany({
      where: {
        customerPurchaseOrderId: order.id,
        id: { not: release.id },
        status: { in: [...COMMITTED_RELEASE_STATUSES] },
        committedValue: { not: null },
      },
      select: { committedValue: true },
    })
    const balance = calculateBlanketBalance({
      originalAuthorizedValue: order.originalAuthorizedValue,
      amendmentValues: order.amendments.map((amendment) => amendment.valueDelta),
      committedReleaseValues: otherCommitments.map(
        (commitment) => commitment.committedValue as Prisma.Decimal
      ),
    })
    if (release.expectedNetTotal.greaterThan(balance.availableValue)) {
      throw new CustomerOrderCommitmentError(
        "BLANKET_BALANCE_EXCEEDED",
        "The release exceeds the remaining blanket PO value."
      )
    }
    if (release.expectedNetTotal.equals(balance.availableValue)) {
      nextOrderStatus = "EXHAUSTED"
    }
  }

  const committed = await tx.customerOrderRelease.update({
    where: { id: release.id },
    data: {
      status: "READY_FOR_PLANNING",
      committedValue: release.expectedNetTotal,
      committedAt: now,
      lastValidatedAt: now,
    },
    include: {
      customerPurchaseOrder: true,
      lines: true,
      revisions: true,
    },
  })

  if (order.status !== nextOrderStatus) {
    await tx.customerPurchaseOrder.update({
      where: { id: order.id },
      data: { status: nextOrderStatus },
    })
  }

  return committed
}
