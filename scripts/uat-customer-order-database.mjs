import assert from "node:assert/strict"
import { Prisma, PrismaClient } from "@prisma/client"

import { allocateCustomerOrderNumber } from "../src/features/customer-orders/services/customer-order-numbering.ts"
import { commitCustomerOrderReleaseInTransaction } from "../src/features/customer-orders/services/customer-order-commitment-policy.ts"

const prisma = new PrismaClient()
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

class ExpectedRollback extends Error {}

function pass(name) {
  console.log(`PASS  ${name}`)
}

async function recordCounts() {
  const [legacy, orders, releases, lines, amendments, revisions, auditEvents] = await Promise.all([
    prisma.purchase_orders.count(),
    prisma.customerPurchaseOrder.count(),
    prisma.customerOrderRelease.count(),
    prisma.customerOrderReleaseLine.count(),
    prisma.customerOrderAmendment.count(),
    prisma.customerOrderReleaseRevision.count(),
    prisma.businessAuditEvent.count(),
  ])
  return { legacy, orders, releases, lines, amendments, revisions, auditEvents }
}

async function testReversibleWorkflow() {
  let completed = false
  try {
    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          customer_code: `UAT-CO-${suffix}`,
          legal_name: "UAT Customer Order Company",
          default_currency: "AUD",
        },
      })
      const product = await tx.products.create({
        data: {
          product_code: `UAT-CO-PROD-${suffix}`,
          description: "UAT Customer Order Product",
          customer_id: customer.id,
          units_per_shipper: 24,
          price_per_shipper: 10,
          boms: { create: { revision: 1, status: "ACTIVE" } },
        },
        include: { boms: true },
      })

      const orderNumber = await allocateCustomerOrderNumber(tx, "ORDER")
      const releaseNumber = await allocateCustomerOrderNumber(tx, "RELEASE")
      const order = await tx.customerPurchaseOrder.create({
        data: {
          internalOrderNumber: orderNumber,
          customerId: customer.id,
          type: "BLANKET",
          customerPoNumber: `UAT-BLANKET-${suffix}`,
          originalAuthorizedValue: 60000,
          currency: "AUD",
          receivedDate: new Date("2026-09-14T00:00:00.000Z"),
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          status: "ACTIVE",
          amendments: {
            create: {
              valueDelta: 10000,
              previousAuthorizedValue: 60000,
              resultingAuthorizedValue: 70000,
              receivedDate: new Date("2026-09-14T00:00:00.000Z"),
              effectiveDate: new Date("2026-09-14T00:00:00.000Z"),
              reason: "UAT top-up",
            },
          },
        },
      })
      const draftRelease = await tx.customerOrderRelease.create({
        data: {
          customerPurchaseOrderId: order.id,
          internalReleaseNumber: releaseNumber,
          receivedDate: new Date("2026-09-14T00:00:00.000Z"),
          customerNetTotal: 1000,
          expectedNetTotal: 1000,
          varianceAmount: 0,
          variancePercentage: 0,
          tolerancePercentageSnapshot: 0,
          validationIssues: [],
          status: "DRAFT",
          lastValidatedAt: new Date(),
          lines: {
            create: {
              position: 1,
              productId: product.id,
              bomId: product.boms[0].id,
              productCodeSnapshot: product.product_code,
              productDescriptionSnapshot: product.description,
              orderedQuantity: 2400,
              orderUom: "UNIT",
              requestedDeliveryDate: new Date("2026-10-01T00:00:00.000Z"),
              unitsPerShipperSnapshot: 24,
              pricePerShipperSnapshot: 10,
              calculatedShippers: 100,
              customerLineValue: 1000,
              expectedLineValue: 1000,
              varianceAmount: 0,
              variancePercentage: 0,
              validationStatus: "VALID",
              validationIssues: [],
            },
          },
          revisions: {
            create: {
              revision: 1,
              snapshot: { status: "READY_FOR_PLANNING", expectedNetTotal: "1000.00" },
              changeReason: "Initial UAT validation",
            },
          },
        },
      })
      const release = await commitCustomerOrderReleaseInTransaction(
        tx,
        draftRelease.id,
        new Date("2026-09-14T12:00:00.000Z")
      )
      assert.equal(release.status, "READY_FOR_PLANNING")
      assert.equal(release.committedValue?.toFixed(2), "1000.00")
      await tx.businessAuditEvent.create({
        data: {
          eventType: "customer_order.release.ready_for_planning",
          outcome: "SUCCESS",
          targetType: "CUSTOMER_ORDER_RELEASE",
          targetId: release.id,
          correlationId: crypto.randomUUID(),
          metadata: { revision: 1, expectedNetTotal: "1000.00" },
        },
      })

      const stored = await tx.customerPurchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          amendments: true,
          releases: { include: { lines: true, revisions: true } },
        },
      })
      assert.equal(stored.amendments.length, 1)
      assert.equal(stored.releases.length, 1)
      assert.equal(stored.releases[0].lines.length, 1)
      assert.equal(stored.releases[0].revisions.length, 1)
      assert.equal(stored.releases[0].lines[0].calculatedShippers.toFixed(), "100")
      completed = true
      throw new ExpectedRollback("Rollback Customer Order database UAT data")
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error
  }
  assert.equal(completed, true)
  pass("Normalized Customer Order workflow is relational and reversible")
}

async function testDatabaseGuards() {
  const expectedConstraints = [
    "customer_order_settings_tolerance_range",
    "customer_purchase_orders_active_blanket_complete",
    "customer_order_amendments_positive_top_up",
    "customer_order_amendments_value_chain",
    "customer_order_releases_commitment_complete",
    "customer_order_release_lines_values_valid",
  ]
  const constraints = await prisma.$queryRaw`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (${Prisma.join(expectedConstraints)})
  `
  assert.deepEqual(
    constraints.map((constraint) => constraint.conname).sort(),
    [...expectedConstraints].sort()
  )

  const expectedTriggers = [
    "customer_order_amendments_append_only",
    "customer_order_release_revisions_append_only",
    "business_audit_events_append_only",
  ]
  const triggers = await prisma.$queryRaw`
    SELECT tgname
    FROM pg_trigger
    WHERE NOT tgisinternal AND tgname IN (${Prisma.join(expectedTriggers)})
  `
  assert.deepEqual(
    triggers.map((trigger) => trigger.tgname).sort(),
    [...expectedTriggers].sort()
  )
  pass("Database checks and append-only history triggers are installed")
}

async function main() {
  const before = await recordCounts()
  const settings = await prisma.customerOrderSettings.findUniqueOrThrow({ where: { id: "DEFAULT" } })
  assert.equal(settings.priceTolerancePercent.toFixed(4), "0.0000")
  assert.equal(settings.currencyDecimalPlaces, 2)
  pass("Safe default Customer Order settings are installed")

  await testDatabaseGuards()
  await testReversibleWorkflow()

  const after = await recordCounts()
  assert.deepEqual(after, before, "Database UAT must not persist records or alter legacy counts")
  pass(`All UAT records rolled back; ${after.legacy} legacy orders remain unchanged`)
}

main()
  .catch((error) => {
    console.error("Customer Order database UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
