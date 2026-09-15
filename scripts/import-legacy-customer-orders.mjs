import { Prisma, PrismaClient } from "@prisma/client"

import {
  legacyValidationIssues,
  loadLegacyCustomerOrderMigrationPlan,
} from "./lib/legacy-customer-order-migration.mjs"

const prisma = new PrismaClient()

function dateOnly(value) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function importDate(order) {
  return dateOnly(order.po_received_date ?? order.po_created_date ?? order.created_at)
}

function internalNumber(prefix, order) {
  const readable = `${prefix}${order.po_number}`
  return readable.length <= 40 ? readable : `${prefix}${order.id.replaceAll("-", "").slice(0, 40 - prefix.length)}`
}

async function main() {
  const before = await loadLegacyCustomerOrderMigrationPlan(prisma)
  if (before.blockedRows.length > 0) {
    throw new Error(
      `Import blocked: ${before.blockedRows.length} legacy rows require review. Run npm run audit:customer-order-migration.`
    )
  }
  if (before.readyRows.length === 0) {
    console.log(JSON.stringify({
      mode: "APPLY_IDEMPOTENT",
      imported: 0,
      alreadyMigrated: before.alreadyMigratedRows.length,
      message: "No unmigrated legacy Customer Orders remain.",
    }, null, 2))
    return
  }

  const imported = await prisma.$transaction(async (tx) => {
    let count = 0
    for (const row of before.readyRows) {
      const { order, product, customer, statuses } = row
      const receivedDate = importDate(order)
      const issues = legacyValidationIssues(row)
      const releaseStatus = statuses.releaseStatus
      const orderNumber = internalNumber("LEGACY-PO-", order)
      const releaseNumber = internalNumber("LEGACY-REL-", order)
      const completed = releaseStatus === "COMPLETED"
      const cancelled = releaseStatus === "CANCELLED"

      const normalizedOrder = await tx.customerPurchaseOrder.create({
        data: {
          internalOrderNumber: orderNumber,
          customerId: customer.id,
          type: "STANDARD",
          customerPoNumber: order.po_number,
          originalAuthorizedValue: 0,
          currency: customer.default_currency.trim().toUpperCase(),
          receivedDate,
          status: statuses.orderStatus,
          createdAt: order.created_at,
          releases: {
            create: {
              internalReleaseNumber: releaseNumber,
              receivedDate,
              customerNetTotal: order.customer_amount,
              expectedNetTotal: order.system_amount,
              varianceAmount: row.variance.amount,
              variancePercentage: row.variance.percentage,
              validationIssues: issues,
              status: releaseStatus,
              committedValue: completed ? order.system_amount : null,
              committedAt: completed ? order.updated_at : null,
              cancelledAt: cancelled ? order.updated_at : null,
              lastValidatedAt: null,
              createdAt: order.created_at,
              lines: {
                create: {
                  position: 1,
                  productId: product.id,
                  bomId: row.activeBom?.id ?? null,
                  productCodeSnapshot: product.product_code.slice(0, 100),
                  productDescriptionSnapshot: (order.description ?? product.description)?.slice(0, 500),
                  orderedQuantity: row.orderedQuantity,
                  orderUom: row.orderUom,
                  requestedDeliveryDate: order.requested_delivery_date,
                  unitsPerShipperSnapshot: product.units_per_shipper,
                  pricePerShipperSnapshot: row.historicalPrice,
                  calculatedShippers: row.calculatedShippers,
                  customerLineValue: order.customer_amount,
                  expectedLineValue: order.system_amount,
                  varianceAmount: row.variance.amount,
                  variancePercentage: row.variance.percentage,
                  validationStatus: "PO_CHECK",
                  validationIssues: issues,
                  legacyPurchaseOrderId: order.id,
                  createdAt: order.created_at,
                },
              },
              revisions: {
                create: {
                  revision: 1,
                  snapshot: {
                    source: "LEGACY_PURCHASE_ORDER",
                    legacyPurchaseOrderId: order.id,
                    legacyStatus: order.current_status,
                    normalizedStatus: releaseStatus,
                    missingRequestedDeliveryDate: !order.requested_delivery_date,
                    customerResolutionMethod: row.customerResolutionMethod,
                  },
                  changeReason: "Imported from preserved legacy Customer Order data",
                  createdAt: order.updated_at,
                },
              },
            },
          },
        },
      })
      await tx.businessAuditEvent.create({
        data: {
          eventType: "customer_order.legacy_imported",
          outcome: "SUCCESS",
          targetType: "CUSTOMER_ORDER",
          targetId: normalizedOrder.id,
          correlationId: crypto.randomUUID(),
          occurredAt: new Date(),
          metadata: {
            legacyPurchaseOrderId: order.id,
            legacyStatus: order.current_status,
            internalOrderNumber: orderNumber,
          },
        },
      })
      count += 1
    }
    return count
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  })

  const after = await loadLegacyCustomerOrderMigrationPlan(prisma)
  if (after.blockedRows.length > 0 || after.readyRows.length > 0) {
    throw new Error("Post-import reconciliation failed: unmigrated or blocked legacy rows remain.")
  }
  const [orders, releases, lines] = await Promise.all([
    prisma.customerPurchaseOrder.count(),
    prisma.customerOrderRelease.count(),
    prisma.customerOrderReleaseLine.count(),
  ])
  console.log(JSON.stringify({
    mode: "APPLY_IDEMPOTENT",
    imported,
    alreadyMigrated: after.alreadyMigratedRows.length,
    normalizedTargetCounts: { orders, releases, lines },
    legacyRowsRetained: after.rows.length,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Legacy Customer Order import failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
