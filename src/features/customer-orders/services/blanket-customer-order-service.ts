import "server-only"

import { Prisma } from "@prisma/client"

import type { AuthorizationPrincipal } from "@/features/auth/services/authorization-policy"
import { prisma } from "@/lib/db"
import type {
  AddBlanketAmendmentInput,
  CancelCustomerOrderInput,
  CreateBlanketCustomerOrderInput,
  CreateBlanketReleaseInput,
  UpdateBlanketReleaseInput,
} from "../types/customer-order-schema"
import { calculateBlanketBalance } from "./blanket-balance"
import {
  createBusinessCorrelationId,
  writeCustomerOrderAuditEvent,
} from "./customer-order-audit-service"
import { commitCustomerOrderReleaseInTransaction } from "./customer-order-commitment-policy"
import { allocateCustomerOrderNumber } from "./customer-order-numbering"
import { CustomerOrderWorkflowError } from "./customer-order-service"
import {
  validateCustomerOrderLine,
  validateCustomerOrderRelease,
  type CustomerOrderValidationIssue,
} from "./customer-order-validation"

const MAX_TRANSACTION_ATTEMPTS = 3
const COMMITTED_RELEASE_STATUSES = [
  "READY_FOR_PLANNING",
  "PLANNING",
  "PLANNED",
  "IN_PRODUCTION",
  "COMPLETED",
] as const

type BlanketReleaseDraftInput = Omit<CreateBlanketReleaseInput, "orderId">

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function optionalDateFromInput(value: string): Date | null {
  return value ? dateFromInput(value) : null
}

function issuesAsJson(issues: readonly CustomerOrderValidationIssue[]): Prisma.InputJsonValue {
  return issues.map((issue) => ({ code: issue.code, message: issue.message }))
}

function decimalString(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null
}

async function lockBlanketOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "customer_purchase_orders"
    WHERE "id" = ${orderId}::uuid
    FOR UPDATE
  `
}

async function withSerializableRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      })
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
      if (!retryable || attempt === MAX_TRANSACTION_ATTEMPTS) throw error
    }
  }
  throw new Error("Blanket Customer Order transaction retry loop ended unexpectedly.")
}

function blanketBalanceFromOrder(
  order: {
    originalAuthorizedValue: Prisma.Decimal
    amendments: readonly { valueDelta: Prisma.Decimal }[]
    releases: readonly {
      id: string
      status: string
      committedValue: Prisma.Decimal | null
    }[]
  },
  excludeReleaseId?: string
) {
  return calculateBlanketBalance({
    originalAuthorizedValue: order.originalAuthorizedValue,
    amendmentValues: order.amendments.map((amendment) => amendment.valueDelta),
    committedReleaseValues: order.releases
      .filter(
        (release) =>
          release.id !== excludeReleaseId &&
          COMMITTED_RELEASE_STATUSES.includes(
            release.status as (typeof COMMITTED_RELEASE_STATUSES)[number]
          ) &&
          release.committedValue !== null
      )
      .map((release) => release.committedValue as Prisma.Decimal),
  })
}

async function prepareBlanketRelease(
  tx: Prisma.TransactionClient,
  order: {
    id: string
    customerId: string
    status: string
    validFrom: Date | null
    validTo: Date | null
    customer: { is_active: boolean }
    originalAuthorizedValue: Prisma.Decimal
    amendments: readonly { valueDelta: Prisma.Decimal }[]
    releases: readonly {
      id: string
      status: string
      committedValue: Prisma.Decimal | null
    }[]
  },
  input: BlanketReleaseDraftInput,
  excludeReleaseId?: string
) {
  const [settings, products] = await Promise.all([
    tx.customerOrderSettings.findUniqueOrThrow({ where: { id: "DEFAULT" } }),
    tx.products.findMany({
      where: { id: { in: [...new Set(input.lines.map((line) => line.productId))] } },
      include: {
        boms: {
          where: { status: "ACTIVE" },
          orderBy: { revision: "desc" },
          take: 1,
        },
      },
    }),
  ])
  const productsById = new Map(products.map((product) => [product.id, product]))
  const lineRecords = input.lines.map((line, index) => {
    const product = productsById.get(line.productId)
    if (!product) {
      throw new CustomerOrderWorkflowError(`Product on line ${index + 1} no longer exists.`)
    }
    const requestedDeliveryDate = optionalDateFromInput(
      line.requestedDeliveryDate || input.defaultRequestedDeliveryDate
    )
    const result = validateCustomerOrderLine({
      customerActive: order.customer.is_active,
      selectedCustomerId: order.customerId,
      productActive: product.is_active,
      productCustomerId: product.customer_id,
      activeBomId: product.boms[0]?.id ?? null,
      orderedQuantity: line.orderedQuantity,
      orderUom: line.orderUom,
      requestedDeliveryDate,
      unitsPerShipper: product.units_per_shipper?.toString() ?? null,
      approvedPricePerShipper: product.price_per_shipper,
      customerLineValue: line.customerLineValue,
      tolerancePercentage: settings.priceTolerancePercent,
      currencyDecimalPlaces: settings.currencyDecimalPlaces,
    })
    return {
      input: line,
      position: index + 1,
      product,
      activeBom: product.boms[0] ?? null,
      requestedDeliveryDate,
      result,
    }
  })
  const balance = blanketBalanceFromOrder(order, excludeReleaseId)
  const effectiveBlanketStatus =
    order.status === "EXHAUSTED" && excludeReleaseId && balance.availableValue.greaterThan(0)
      ? "ACTIVE"
      : order.status
  const validation = validateCustomerOrderRelease({
    orderType: "BLANKET",
    customerNetTotal: input.customerNetTotal,
    lines: lineRecords.map((line) => line.result),
    lineCustomerValues: input.lines.map((line) => line.customerLineValue),
    tolerancePercentage: settings.priceTolerancePercent,
    currencyDecimalPlaces: settings.currencyDecimalPlaces,
    blanket: {
      status: effectiveBlanketStatus,
      validFrom: order.validFrom,
      validTo: order.validTo,
      availableValue: balance.availableValue,
    },
    validationDate: dateFromInput(input.receivedDate),
  })
  return { settings, lineRecords, balance, validation }
}

function releaseSnapshot(input: {
  status: "PO_CHECK" | "READY_FOR_PLANNING"
  customerNetTotal: string
  expectedNetTotal: Prisma.Decimal | null
  tolerancePercentage: Prisma.Decimal
  issues: readonly CustomerOrderValidationIssue[]
  lines: Awaited<ReturnType<typeof prepareBlanketRelease>>["lineRecords"]
}): Prisma.InputJsonValue {
  return {
    status: input.status,
    customerNetTotal: input.customerNetTotal,
    expectedNetTotal: decimalString(input.expectedNetTotal),
    tolerancePercentage: input.tolerancePercentage.toString(),
    issueCodes: input.issues.map((issue) => issue.code),
    lines: input.lines.map((line) => ({
      position: line.position,
      productId: line.product.id,
      orderUom: line.input.orderUom,
      orderedQuantity: line.input.orderedQuantity,
      requestedDeliveryDate: line.requestedDeliveryDate?.toISOString().slice(0, 10) ?? null,
      customerLineValue: line.input.customerLineValue,
      calculatedShippers: decimalString(line.result.calculatedShippers),
      expectedLineValue: decimalString(line.result.expectedLineValue),
      issueCodes: line.result.issues.map((issue) => issue.code),
    })),
  }
}

function releaseLineWrites(
  prepared: Awaited<ReturnType<typeof prepareBlanketRelease>>
) {
  return prepared.lineRecords.map((line) => ({
    position: line.position,
    productId: line.product.id,
    bomId: line.activeBom?.id ?? null,
    productCodeSnapshot: line.product.product_code,
    productDescriptionSnapshot: line.product.description,
    orderedQuantity: line.input.orderedQuantity,
    orderUom: line.input.orderUom,
    requestedDeliveryDate: line.requestedDeliveryDate,
    unitsPerShipperSnapshot: line.product.units_per_shipper,
    pricePerShipperSnapshot: line.product.price_per_shipper,
    calculatedShippers: line.result.calculatedShippers,
    customerLineValue: line.input.customerLineValue,
    expectedLineValue: line.result.expectedLineValue,
    varianceAmount: line.result.varianceAmount,
    variancePercentage: line.result.variancePercentage,
    validationStatus: line.result.status,
    validationIssues: issuesAsJson(line.result.issues),
  }))
}

export async function createBlanketCustomerOrder(
  input: CreateBlanketCustomerOrderInput,
  principal: AuthorizationPrincipal
) {
  return withSerializableRetry(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } })
    if (!customer || !customer.is_active) {
      throw new CustomerOrderWorkflowError("Select an active Customer for the Blanket PO.")
    }
    const currency = customer.default_currency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new CustomerOrderWorkflowError(
        "The Customer requires a valid three-letter default currency before an order can be entered."
      )
    }
    const internalOrderNumber = await allocateCustomerOrderNumber(tx, "ORDER")
    const correlationId = createBusinessCorrelationId()
    const order = await tx.customerPurchaseOrder.create({
      data: {
        internalOrderNumber,
        customerId: customer.id,
        type: "BLANKET",
        customerPoNumber: input.customerPoNumber,
        originalAuthorizedValue: input.originalAuthorizedValue,
        currency,
        receivedDate: dateFromInput(input.receivedDate),
        validFrom: dateFromInput(input.validFrom),
        validTo: dateFromInput(input.validTo),
        status: "ACTIVE",
        createdById: principal.userId,
      },
    })
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.created",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER",
      targetId: order.id,
      correlationId,
      metadata: { orderType: "BLANKET", internalOrderNumber },
    }, tx)
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.activated",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER",
      targetId: order.id,
      correlationId,
      metadata: { previousStatus: "DRAFT", nextStatus: "ACTIVE" },
    }, tx)
    return { orderId: order.id, status: "ACTIVE" as const }
  })
}

export async function addBlanketAmendment(
  input: AddBlanketAmendmentInput,
  principal: AuthorizationPrincipal
) {
  return withSerializableRetry(async (tx) => {
    await lockBlanketOrder(tx, input.orderId)
    const order = await tx.customerPurchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        amendments: { select: { valueDelta: true } },
        releases: { select: { id: true, status: true, committedValue: true } },
      },
    })
    if (!order || order.type !== "BLANKET") {
      throw new CustomerOrderWorkflowError("The Blanket PO no longer exists.")
    }
    if (!["ACTIVE", "EXHAUSTED"].includes(order.status)) {
      throw new CustomerOrderWorkflowError("Only an active or exhausted Blanket PO can be topped up.")
    }
    const previousBalance = blanketBalanceFromOrder(order)
    const valueDelta = new Prisma.Decimal(input.valueDelta)
    const resultingAuthorizedValue = previousBalance.currentAuthorizedValue.plus(valueDelta)
    await tx.customerOrderAmendment.create({
      data: {
        customerPurchaseOrderId: order.id,
        valueDelta,
        previousAuthorizedValue: previousBalance.currentAuthorizedValue,
        resultingAuthorizedValue,
        customerReference: input.customerReference || null,
        receivedDate: dateFromInput(input.receivedDate),
        effectiveDate: dateFromInput(input.effectiveDate),
        reason: input.reason,
        recordedById: principal.userId,
      },
    })
    const nextAvailableValue = previousBalance.availableValue.plus(valueDelta)
    const nextStatus: "ACTIVE" | "EXHAUSTED" = nextAvailableValue.greaterThan(0)
      ? "ACTIVE"
      : "EXHAUSTED"
    if (order.status !== nextStatus) {
      await tx.customerPurchaseOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      })
    }
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.blanket.amended",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER",
      targetId: order.id,
      correlationId: createBusinessCorrelationId(),
      metadata: {
        valueDelta: valueDelta.toFixed(2),
        previousAuthorizedValue: previousBalance.currentAuthorizedValue.toFixed(2),
        resultingAuthorizedValue: resultingAuthorizedValue.toFixed(2),
      },
    }, tx)
    return {
      orderId: order.id,
      status: nextStatus,
      availableValue: nextAvailableValue.toFixed(2),
    }
  })
}

export async function createBlanketRelease(
  input: CreateBlanketReleaseInput,
  principal: AuthorizationPrincipal
) {
  return withSerializableRetry(async (tx) => {
    await lockBlanketOrder(tx, input.orderId)
    const order = await tx.customerPurchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        customer: { select: { is_active: true } },
        amendments: { select: { valueDelta: true } },
        releases: { select: { id: true, status: true, committedValue: true } },
      },
    })
    if (!order || order.type !== "BLANKET") {
      throw new CustomerOrderWorkflowError("The Blanket PO no longer exists.")
    }
    if (["CANCELLED", "CLOSED", "EXPIRED"].includes(order.status)) {
      throw new CustomerOrderWorkflowError("This Blanket PO cannot accept new releases.")
    }
    const prepared = await prepareBlanketRelease(tx, order, input)
    const internalReleaseNumber = await allocateCustomerOrderNumber(tx, "RELEASE")
    const correlationId = createBusinessCorrelationId()
    const initialStatus = prepared.validation.status === "PO_CHECK" ? "PO_CHECK" : "DRAFT"
    const release = await tx.customerOrderRelease.create({
      data: {
        customerPurchaseOrderId: order.id,
        internalReleaseNumber,
        customerReleaseReference: input.customerReleaseReference || null,
        receivedDate: dateFromInput(input.receivedDate),
        defaultRequestedDeliveryDate: optionalDateFromInput(input.defaultRequestedDeliveryDate),
        customerNetTotal: input.customerNetTotal,
        expectedNetTotal: prepared.validation.expectedNetTotal,
        varianceAmount: prepared.validation.varianceAmount,
        variancePercentage: prepared.validation.variancePercentage,
        tolerancePercentageSnapshot: prepared.settings.priceTolerancePercent,
        validationIssues: issuesAsJson(prepared.validation.issues),
        status: initialStatus,
        lastValidatedAt: new Date(),
        createdById: principal.userId,
        lines: { create: releaseLineWrites(prepared) },
      },
    })
    await tx.customerOrderReleaseRevision.create({
      data: {
        releaseId: release.id,
        revision: 1,
        snapshot: releaseSnapshot({
          status: prepared.validation.status,
          customerNetTotal: input.customerNetTotal,
          expectedNetTotal: prepared.validation.expectedNetTotal,
          tolerancePercentage: prepared.settings.priceTolerancePercent,
          issues: prepared.validation.issues,
          lines: prepared.lineRecords,
        }),
        changeReason: "Initial Blanket release entry",
        createdById: principal.userId,
      },
    })
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.release.created",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER_RELEASE",
      targetId: release.id,
      correlationId,
      metadata: { internalReleaseNumber, orderType: "BLANKET" },
    }, tx)

    if (prepared.validation.status === "READY_FOR_PLANNING") {
      await commitCustomerOrderReleaseInTransaction(tx, release.id)
      const nextAvailableValue = prepared.balance.availableValue.minus(
        prepared.validation.expectedNetTotal as Prisma.Decimal
      )
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.value_committed",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: release.id,
        correlationId,
        metadata: {
          committedValue: prepared.validation.expectedNetTotal?.toFixed(2) ?? null,
          availableValue: nextAvailableValue.toFixed(2),
        },
      }, tx)
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.ready_for_planning",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: release.id,
        correlationId,
        metadata: {
          revision: 1,
          expectedNetTotal: prepared.validation.expectedNetTotal?.toFixed(2) ?? null,
        },
      }, tx)
    } else {
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.validation_failed",
        outcome: "FAILURE",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: release.id,
        correlationId,
        metadata: {
          revision: 1,
          issueCodes: prepared.validation.issues.map((issue) => issue.code),
        },
      }, tx)
    }
    return {
      orderId: order.id,
      releaseId: release.id,
      status: prepared.validation.status,
      issueCodes: prepared.validation.issues.map((issue) => issue.code),
    }
  })
}

export async function updateBlanketRelease(
  input: UpdateBlanketReleaseInput,
  principal: AuthorizationPrincipal
) {
  return withSerializableRetry(async (tx) => {
    await lockBlanketOrder(tx, input.orderId)
    const order = await tx.customerPurchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        customer: { select: { is_active: true } },
        amendments: { select: { valueDelta: true } },
        releases: { select: { id: true, status: true, committedValue: true } },
      },
    })
    const existingRelease = order?.releases.find((release) => release.id === input.releaseId)
    if (!order || order.type !== "BLANKET" || !existingRelease) {
      throw new CustomerOrderWorkflowError("The Blanket release no longer exists.")
    }
    if (!["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(existingRelease.status)) {
      throw new CustomerOrderWorkflowError(
        "This release has entered planning or production and cannot be corrected yet."
      )
    }
    if (["CANCELLED", "CLOSED", "EXPIRED"].includes(order.status)) {
      throw new CustomerOrderWorkflowError("This Blanket PO cannot revalidate releases.")
    }
    const prepared = await prepareBlanketRelease(tx, order, input, existingRelease.id)
    const currentRelease = await tx.customerOrderRelease.findUniqueOrThrow({
      where: { id: existingRelease.id },
      select: { revisionNumber: true },
    })
    const nextRevision = currentRelease.revisionNumber + 1
    const initialStatus = prepared.validation.status === "PO_CHECK" ? "PO_CHECK" : "DRAFT"
    const correlationId = createBusinessCorrelationId()
    await tx.customerOrderReleaseLine.deleteMany({ where: { releaseId: existingRelease.id } })
    await tx.customerOrderRelease.update({
      where: { id: existingRelease.id },
      data: {
        customerReleaseReference: input.customerReleaseReference || null,
        receivedDate: dateFromInput(input.receivedDate),
        defaultRequestedDeliveryDate: optionalDateFromInput(input.defaultRequestedDeliveryDate),
        customerNetTotal: input.customerNetTotal,
        expectedNetTotal: prepared.validation.expectedNetTotal,
        varianceAmount: prepared.validation.varianceAmount,
        variancePercentage: prepared.validation.variancePercentage,
        tolerancePercentageSnapshot: prepared.settings.priceTolerancePercent,
        validationIssues: issuesAsJson(prepared.validation.issues),
        status: initialStatus,
        revisionNumber: nextRevision,
        committedValue: null,
        committedAt: null,
        lastValidatedAt: new Date(),
        lines: { create: releaseLineWrites(prepared) },
      },
    })
    await tx.customerOrderReleaseRevision.create({
      data: {
        releaseId: existingRelease.id,
        revision: nextRevision,
        snapshot: releaseSnapshot({
          status: prepared.validation.status,
          customerNetTotal: input.customerNetTotal,
          expectedNetTotal: prepared.validation.expectedNetTotal,
          tolerancePercentage: prepared.settings.priceTolerancePercent,
          issues: prepared.validation.issues,
          lines: prepared.lineRecords,
        }),
        changeReason: "Customer Service Blanket release correction",
        createdById: principal.userId,
      },
    })
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.release.revised",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER_RELEASE",
      targetId: existingRelease.id,
      correlationId,
      metadata: {
        revision: nextRevision,
        changedFields: ["receivedDate", "customerReleaseReference", "releaseLines"],
        reason: "Customer Service Blanket release correction",
      },
    }, tx)

    if (order.status === "EXHAUSTED" && prepared.balance.availableValue.greaterThan(0)) {
      await tx.customerPurchaseOrder.update({
        where: { id: order.id },
        data: { status: "ACTIVE" },
      })
    }

    if (prepared.validation.status === "READY_FOR_PLANNING") {
      await commitCustomerOrderReleaseInTransaction(tx, existingRelease.id)
      const nextAvailableValue = prepared.balance.availableValue.minus(
        prepared.validation.expectedNetTotal as Prisma.Decimal
      )
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.value_committed",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: existingRelease.id,
        correlationId,
        metadata: {
          committedValue: prepared.validation.expectedNetTotal?.toFixed(2) ?? null,
          availableValue: nextAvailableValue.toFixed(2),
        },
      }, tx)
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.validation_passed",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: existingRelease.id,
        correlationId,
        metadata: {
          revision: nextRevision,
          expectedNetTotal: prepared.validation.expectedNetTotal?.toFixed(2) ?? null,
        },
      }, tx)
    } else {
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.validation_failed",
        outcome: "FAILURE",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: existingRelease.id,
        correlationId,
        metadata: {
          revision: nextRevision,
          issueCodes: prepared.validation.issues.map((issue) => issue.code),
        },
      }, tx)
    }
    return {
      orderId: order.id,
      releaseId: existingRelease.id,
      status: prepared.validation.status,
      issueCodes: prepared.validation.issues.map((issue) => issue.code),
    }
  })
}

export async function cancelBlanketRelease(
  input: CancelCustomerOrderInput,
  principal: AuthorizationPrincipal
) {
  return withSerializableRetry(async (tx) => {
    await lockBlanketOrder(tx, input.orderId)
    const order = await tx.customerPurchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        amendments: { select: { valueDelta: true } },
        releases: { select: { id: true, status: true, committedValue: true, revisionNumber: true } },
      },
    })
    const release = order?.releases.find((candidate) => candidate.id === input.releaseId)
    if (!order || order.type !== "BLANKET" || !release) {
      throw new CustomerOrderWorkflowError("The Blanket release no longer exists.")
    }
    if (release.status === "CANCELLED") {
      return { orderId: order.id, releaseId: release.id, status: "CANCELLED" as const }
    }
    if (!["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(release.status)) {
      throw new CustomerOrderWorkflowError(
        "This release has entered planning or production and requires operational change review before cancellation."
      )
    }
    const correlationId = createBusinessCorrelationId()
    const nextRevision = release.revisionNumber + 1
    await tx.customerOrderRelease.update({
      where: { id: release.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        revisionNumber: nextRevision,
      },
    })
    await tx.customerOrderReleaseRevision.create({
      data: {
        releaseId: release.id,
        revision: nextRevision,
        snapshot: {
          status: "CANCELLED",
          previousStatus: release.status,
          committedValue: release.committedValue?.toString() ?? null,
        },
        changeReason: input.reason,
        createdById: principal.userId,
      },
    })
    const restoredBalance = blanketBalanceFromOrder({
      ...order,
      releases: order.releases.map((candidate) =>
        candidate.id === release.id ? { ...candidate, status: "CANCELLED" } : candidate
      ),
    })
    const nextOrderStatus = restoredBalance.availableValue.greaterThan(0)
      ? "ACTIVE"
      : "EXHAUSTED"
    if (["ACTIVE", "EXHAUSTED"].includes(order.status) && order.status !== nextOrderStatus) {
      await tx.customerPurchaseOrder.update({
        where: { id: order.id },
        data: { status: nextOrderStatus },
      })
    }
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.release.cancelled",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER_RELEASE",
      targetId: release.id,
      correlationId,
      metadata: { previousStatus: release.status, nextStatus: "CANCELLED", reason: input.reason },
    }, tx)
    if (release.committedValue) {
      await writeCustomerOrderAuditEvent({
        eventType: "customer_order.release.value_released",
        outcome: "SUCCESS",
        actorUserId: principal.userId,
        actorEmailSnapshot: principal.email,
        targetType: "CUSTOMER_ORDER_RELEASE",
        targetId: release.id,
        correlationId,
        metadata: {
          releasedValue: release.committedValue.toFixed(2),
          availableValue: restoredBalance.availableValue.toFixed(2),
        },
      }, tx)
    }
    return {
      orderId: order.id,
      releaseId: release.id,
      status: "CANCELLED" as const,
      availableValue: restoredBalance.availableValue.toFixed(2),
    }
  })
}

export function getBlanketBalanceForDisplay(order: {
  originalAuthorizedValue: Prisma.Decimal
  amendments: readonly { valueDelta: Prisma.Decimal }[]
  releases: readonly { id: string; status: string; committedValue: Prisma.Decimal | null }[]
}) {
  return blanketBalanceFromOrder(order)
}
