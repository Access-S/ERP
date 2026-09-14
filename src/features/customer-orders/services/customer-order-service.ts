import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import type { AuthorizationPrincipal } from "@/features/auth/services/authorization-policy"
import type {
  CancelCustomerOrderInput,
  CreateStandardCustomerOrderInput,
  UpdateStandardCustomerOrderInput,
} from "../types/customer-order-schema"
import { allocateCustomerOrderNumber } from "./customer-order-numbering"
import {
  validateCustomerOrderLine,
  validateCustomerOrderRelease,
  type CustomerOrderValidationIssue,
} from "./customer-order-validation"
import { commitCustomerOrderReleaseInTransaction } from "./customer-order-commitment-policy"
import {
  createBusinessCorrelationId,
  writeCustomerOrderAuditEvent,
} from "./customer-order-audit-service"

const MAX_TRANSACTION_ATTEMPTS = 3

export class CustomerOrderWorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CustomerOrderWorkflowError"
  }
}

export async function cancelStandardCustomerOrder(
  input: CancelCustomerOrderInput,
  principal: AuthorizationPrincipal
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.customerPurchaseOrder.findUnique({
      where: { id: input.orderId },
      include: {
        releases: { where: { id: input.releaseId } },
      },
    })
    const release = order?.releases[0]
    if (!order || !release || order.type !== "STANDARD") {
      throw new CustomerOrderWorkflowError("The Standard Customer PO no longer exists.")
    }
    if (order.status === "CANCELLED" && release.status === "CANCELLED") {
      return { orderId: order.id, releaseId: release.id, status: "CANCELLED" as const }
    }
    if (!["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(release.status)) {
      throw new CustomerOrderWorkflowError(
        "This release has entered planning or production and requires operational change review before cancellation."
      )
    }

    const correlationId = createBusinessCorrelationId()
    const now = new Date()
    const nextRevision = release.revisionNumber + 1
    await tx.customerPurchaseOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    })
    await tx.customerOrderRelease.update({
      where: { id: release.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
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
          customerNetTotal: release.customerNetTotal?.toString() ?? null,
          expectedNetTotal: release.expectedNetTotal?.toString() ?? null,
        },
        changeReason: input.reason,
        createdById: principal.userId,
      },
    })
    await writeCustomerOrderAuditEvent({
      eventType: "customer_order.cancelled",
      outcome: "SUCCESS",
      actorUserId: principal.userId,
      actorEmailSnapshot: principal.email,
      targetType: "CUSTOMER_ORDER",
      targetId: order.id,
      correlationId,
      metadata: {
        previousStatus: order.status,
        nextStatus: "CANCELLED",
        reason: input.reason,
      },
    }, tx)

    return { orderId: order.id, releaseId: release.id, status: "CANCELLED" as const }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })
}

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

function releaseSnapshot(input: {
  status: "PO_CHECK" | "READY_FOR_PLANNING"
  customerNetTotal: string
  expectedNetTotal: Prisma.Decimal | null
  tolerancePercentage: Prisma.Decimal
  issues: readonly CustomerOrderValidationIssue[]
  lines: readonly {
    position: number
    productId: string
    orderUom: "UNIT" | "SHIPPER"
    orderedQuantity: string
    requestedDeliveryDate: Date | null
    customerLineValue: string
    calculatedShippers: Prisma.Decimal | null
    expectedLineValue: Prisma.Decimal | null
    issues: readonly CustomerOrderValidationIssue[]
  }[]
}): Prisma.InputJsonValue {
  return {
    status: input.status,
    customerNetTotal: input.customerNetTotal,
    expectedNetTotal: decimalString(input.expectedNetTotal),
    tolerancePercentage: input.tolerancePercentage.toString(),
    issueCodes: input.issues.map((issue) => issue.code),
    lines: input.lines.map((line) => ({
      position: line.position,
      productId: line.productId,
      orderUom: line.orderUom,
      orderedQuantity: line.orderedQuantity,
      requestedDeliveryDate: line.requestedDeliveryDate?.toISOString().slice(0, 10) ?? null,
      customerLineValue: line.customerLineValue,
      calculatedShippers: decimalString(line.calculatedShippers),
      expectedLineValue: decimalString(line.expectedLineValue),
      issueCodes: line.issues.map((issue) => issue.code),
    })),
  }
}

export async function getCustomerOrderCreateOptions() {
  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: { is_active: true },
      orderBy: [{ customer_code: "asc" }],
      select: {
        id: true,
        customer_code: true,
        legal_name: true,
        trading_name: true,
        default_currency: true,
        products: {
          where: { is_active: true },
          orderBy: [{ product_code: "asc" }],
          select: {
            id: true,
            product_code: true,
            description: true,
            units_per_shipper: true,
            price_per_shipper: true,
            boms: {
              where: { status: "ACTIVE" },
              orderBy: { revision: "desc" },
              take: 1,
              select: { id: true, revision: true },
            },
          },
        },
      },
    }),
    prisma.customerOrderSettings.findUniqueOrThrow({ where: { id: "DEFAULT" } }),
  ])

  return {
    tolerancePercentage: settings.priceTolerancePercent.toString(),
    customers: customers.map((customer) => ({
      id: customer.id,
      code: customer.customer_code,
      name: customer.trading_name ?? customer.legal_name,
      currency: customer.default_currency,
      products: customer.products.map((product) => ({
        id: product.id,
        code: product.product_code,
        description: product.description,
        unitsPerShipper: product.units_per_shipper,
        pricePerShipper: product.price_per_shipper?.toString() ?? null,
        activeBomId: product.boms[0]?.id ?? null,
        activeBomRevision: product.boms[0]?.revision ?? null,
      })),
    })),
  }
}

export type CustomerOrderCreateOptions = Awaited<
  ReturnType<typeof getCustomerOrderCreateOptions>
>

export async function createStandardCustomerOrder(
  input: CreateStandardCustomerOrderInput,
  principal: AuthorizationPrincipal
) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [customer, settings, products] = await Promise.all([
          tx.customer.findUnique({ where: { id: input.customerId } }),
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
        if (!customer) throw new CustomerOrderWorkflowError("The selected Customer no longer exists.")

        const currency = customer.default_currency.trim().toUpperCase()
        if (!/^[A-Z]{3}$/.test(currency)) {
          throw new CustomerOrderWorkflowError(
            "The Customer requires a valid three-letter default currency before an order can be entered."
          )
        }

        const productsById = new Map(products.map((product) => [product.id, product]))
        const lineRecords = input.lines.map((line, index) => {
          const product = productsById.get(line.productId)
          if (!product) {
            throw new CustomerOrderWorkflowError(
              `Product on line ${index + 1} no longer exists.`
            )
          }
          const requestedDeliveryDate = optionalDateFromInput(
            line.requestedDeliveryDate || input.defaultRequestedDeliveryDate
          )
          const result = validateCustomerOrderLine({
            customerActive: customer.is_active,
            selectedCustomerId: customer.id,
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
        const releaseValidation = validateCustomerOrderRelease({
          orderType: "STANDARD",
          customerNetTotal: input.customerNetTotal,
          lines: lineRecords.map((line) => line.result),
          lineCustomerValues: input.lines.map((line) => line.customerLineValue),
          tolerancePercentage: settings.priceTolerancePercent,
          currencyDecimalPlaces: settings.currencyDecimalPlaces,
        })
        const [internalOrderNumber, internalReleaseNumber] = await Promise.all([
          allocateCustomerOrderNumber(tx, "ORDER"),
          allocateCustomerOrderNumber(tx, "RELEASE"),
        ])
        const correlationId = createBusinessCorrelationId()
        const order = await tx.customerPurchaseOrder.create({
          data: {
            internalOrderNumber,
            customerId: customer.id,
            type: "STANDARD",
            customerPoNumber: input.customerPoNumber,
            originalAuthorizedValue: 0,
            currency,
            receivedDate: dateFromInput(input.receivedDate),
            status: "DRAFT",
            createdById: principal.userId,
          },
        })
        const release = await tx.customerOrderRelease.create({
          data: {
            customerPurchaseOrderId: order.id,
            internalReleaseNumber,
            customerReleaseReference: input.customerReleaseReference || null,
            receivedDate: dateFromInput(input.receivedDate),
            defaultRequestedDeliveryDate: optionalDateFromInput(
              input.defaultRequestedDeliveryDate
            ),
            customerNetTotal: input.customerNetTotal,
            expectedNetTotal: releaseValidation.expectedNetTotal,
            varianceAmount: releaseValidation.varianceAmount,
            variancePercentage: releaseValidation.variancePercentage,
            tolerancePercentageSnapshot: settings.priceTolerancePercent,
            validationIssues: issuesAsJson(releaseValidation.issues),
            status: releaseValidation.status === "PO_CHECK" ? "PO_CHECK" : "DRAFT",
            lastValidatedAt: new Date(),
            createdById: principal.userId,
            lines: {
              create: lineRecords.map((line) => ({
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
              })),
            },
          },
        })
        const snapshot = releaseSnapshot({
          status: releaseValidation.status,
          customerNetTotal: input.customerNetTotal,
          expectedNetTotal: releaseValidation.expectedNetTotal,
          tolerancePercentage: settings.priceTolerancePercent,
          issues: releaseValidation.issues,
          lines: lineRecords.map((line) => ({
            position: line.position,
            productId: line.product.id,
            orderUom: line.input.orderUom,
            orderedQuantity: line.input.orderedQuantity,
            requestedDeliveryDate: line.requestedDeliveryDate,
            customerLineValue: line.input.customerLineValue,
            calculatedShippers: line.result.calculatedShippers,
            expectedLineValue: line.result.expectedLineValue,
            issues: line.result.issues,
          })),
        })
        await tx.customerOrderReleaseRevision.create({
          data: {
            releaseId: release.id,
            revision: 1,
            snapshot,
            changeReason: "Initial Customer PO entry",
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
          metadata: { orderType: "STANDARD", internalOrderNumber },
        }, tx)
        await writeCustomerOrderAuditEvent({
          eventType: "customer_order.release.created",
          outcome: "SUCCESS",
          actorUserId: principal.userId,
          actorEmailSnapshot: principal.email,
          targetType: "CUSTOMER_ORDER_RELEASE",
          targetId: release.id,
          correlationId,
          metadata: { internalReleaseNumber, orderType: "STANDARD" },
        }, tx)

        let finalStatus = releaseValidation.status
        if (releaseValidation.status === "READY_FOR_PLANNING") {
          await commitCustomerOrderReleaseInTransaction(tx, release.id)
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
              expectedNetTotal: releaseValidation.expectedNetTotal?.toFixed(2) ?? null,
            },
          }, tx)
        } else {
          finalStatus = "PO_CHECK"
          await tx.customerPurchaseOrder.update({
            where: { id: order.id },
            data: { status: "PO_CHECK" },
          })
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
              issueCodes: releaseValidation.issues.map((issue) => issue.code),
            },
          }, tx)
        }

        return {
          orderId: order.id,
          releaseId: release.id,
          status: finalStatus,
          issueCodes: releaseValidation.issues.map((issue) => issue.code),
        }
      }, {
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

  throw new Error("Customer Order creation retry loop ended unexpectedly.")
}

export async function updateStandardCustomerOrder(
  input: UpdateStandardCustomerOrderInput,
  principal: AuthorizationPrincipal
) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.customerPurchaseOrder.findUnique({
          where: { id: input.orderId },
          include: {
            releases: {
              where: { id: input.releaseId },
              include: { lines: true },
            },
          },
        })
        const existingRelease = existing?.releases[0]
        if (!existing || !existingRelease || existing.type !== "STANDARD") {
          throw new CustomerOrderWorkflowError("The Standard Customer PO no longer exists.")
        }
        if (existing.customerId !== input.customerId) {
          throw new CustomerOrderWorkflowError("The Customer cannot be changed after PO creation.")
        }
        if (!["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(existingRelease.status)) {
          throw new CustomerOrderWorkflowError(
            "This release has entered planning or production and cannot be corrected until change-review planning is implemented."
          )
        }

        const [customer, settings, products] = await Promise.all([
          tx.customer.findUnique({ where: { id: existing.customerId } }),
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
        if (!customer) throw new CustomerOrderWorkflowError("The Customer no longer exists.")
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
            customerActive: customer.is_active,
            selectedCustomerId: customer.id,
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
        const releaseValidation = validateCustomerOrderRelease({
          orderType: "STANDARD",
          customerNetTotal: input.customerNetTotal,
          lines: lineRecords.map((line) => line.result),
          lineCustomerValues: input.lines.map((line) => line.customerLineValue),
          tolerancePercentage: settings.priceTolerancePercent,
          currencyDecimalPlaces: settings.currencyDecimalPlaces,
        })
        const nextRevision = existingRelease.revisionNumber + 1
        const nextReleaseStatus = releaseValidation.status === "PO_CHECK" ? "PO_CHECK" : "DRAFT"
        const correlationId = createBusinessCorrelationId()

        await tx.customerPurchaseOrder.update({
          where: { id: existing.id },
          data: {
            customerPoNumber: input.customerPoNumber,
            receivedDate: dateFromInput(input.receivedDate),
            status: nextReleaseStatus === "PO_CHECK" ? "PO_CHECK" : "DRAFT",
          },
        })
        await tx.customerOrderReleaseLine.deleteMany({
          where: { releaseId: existingRelease.id },
        })
        await tx.customerOrderRelease.update({
          where: { id: existingRelease.id },
          data: {
            customerReleaseReference: input.customerReleaseReference || null,
            receivedDate: dateFromInput(input.receivedDate),
            defaultRequestedDeliveryDate: optionalDateFromInput(input.defaultRequestedDeliveryDate),
            customerNetTotal: input.customerNetTotal,
            expectedNetTotal: releaseValidation.expectedNetTotal,
            varianceAmount: releaseValidation.varianceAmount,
            variancePercentage: releaseValidation.variancePercentage,
            tolerancePercentageSnapshot: settings.priceTolerancePercent,
            validationIssues: issuesAsJson(releaseValidation.issues),
            status: nextReleaseStatus,
            revisionNumber: nextRevision,
            committedValue: null,
            committedAt: null,
            lastValidatedAt: new Date(),
            lines: {
              create: lineRecords.map((line) => ({
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
              })),
            },
          },
        })
        await tx.customerOrderReleaseRevision.create({
          data: {
            releaseId: existingRelease.id,
            revision: nextRevision,
            snapshot: releaseSnapshot({
              status: releaseValidation.status,
              customerNetTotal: input.customerNetTotal,
              expectedNetTotal: releaseValidation.expectedNetTotal,
              tolerancePercentage: settings.priceTolerancePercent,
              issues: releaseValidation.issues,
              lines: lineRecords.map((line) => ({
                position: line.position,
                productId: line.product.id,
                orderUom: line.input.orderUom,
                orderedQuantity: line.input.orderedQuantity,
                requestedDeliveryDate: line.requestedDeliveryDate,
                customerLineValue: line.input.customerLineValue,
                calculatedShippers: line.result.calculatedShippers,
                expectedLineValue: line.result.expectedLineValue,
                issues: line.result.issues,
              })),
            }),
            changeReason: "Customer Service correction",
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
            changedFields: ["customerPoNumber", "receivedDate", "releaseLines"],
            reason: "Customer Service correction",
          },
        }, tx)

        if (releaseValidation.status === "READY_FOR_PLANNING") {
          await commitCustomerOrderReleaseInTransaction(tx, existingRelease.id)
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
              expectedNetTotal: releaseValidation.expectedNetTotal?.toFixed(2) ?? null,
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
              issueCodes: releaseValidation.issues.map((issue) => issue.code),
            },
          }, tx)
        }

        return {
          orderId: existing.id,
          releaseId: existingRelease.id,
          status: releaseValidation.status,
          issueCodes: releaseValidation.issues.map((issue) => issue.code),
        }
      }, {
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

  throw new Error("Customer Order update retry loop ended unexpectedly.")
}

export async function getCustomerOrderStats() {
  const [total, poCheck, readyForPlanning] = await Promise.all([
    prisma.customerPurchaseOrder.count(),
    prisma.customerPurchaseOrder.count({ where: { status: "PO_CHECK" } }),
    prisma.customerOrderRelease.count({ where: { status: "READY_FOR_PLANNING" } }),
  ])
  return { total, poCheck, readyForPlanning }
}

export async function getCustomerOrders(search = "") {
  const normalizedSearch = search.trim().slice(0, 100)
  const orders = await prisma.customerPurchaseOrder.findMany({
    where: normalizedSearch
      ? {
          OR: [
            { internalOrderNumber: { contains: normalizedSearch, mode: "insensitive" } },
            { customerPoNumber: { contains: normalizedSearch, mode: "insensitive" } },
            { customer: { customer_code: { contains: normalizedSearch, mode: "insensitive" } } },
            { customer: { legal_name: { contains: normalizedSearch, mode: "insensitive" } } },
            { customer: { trading_name: { contains: normalizedSearch, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      customer: { select: { customer_code: true, legal_name: true, trading_name: true } },
      releases: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          internalReleaseNumber: true,
          status: true,
          customerNetTotal: true,
          expectedNetTotal: true,
        },
      },
      _count: { select: { releases: true } },
    },
  })

  return orders.map((order) => ({
    id: order.id,
    internalOrderNumber: order.internalOrderNumber,
    customerPoNumber: order.customerPoNumber,
    type: order.type,
    status: order.status,
    customerCode: order.customer.customer_code,
    customerName: order.customer.trading_name ?? order.customer.legal_name,
    currency: order.currency,
    receivedDate: order.receivedDate.toISOString(),
    releaseCount: order._count.releases,
    latestRelease: order.releases[0]
      ? {
          ...order.releases[0],
          customerNetTotal: order.releases[0].customerNetTotal?.toString() ?? null,
          expectedNetTotal: order.releases[0].expectedNetTotal?.toString() ?? null,
        }
      : null,
  }))
}

export async function getCustomerOrderById(orderId: string) {
  return prisma.customerPurchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, customer_code: true, legal_name: true, trading_name: true } },
      amendments: { orderBy: { createdAt: "desc" } },
      releases: {
        orderBy: { createdAt: "asc" },
        include: {
          lines: { orderBy: { position: "asc" } },
          revisions: { orderBy: { revision: "desc" } },
        },
      },
    },
  })
}
