import { PrismaClient } from "@prisma/client"

import { loadLegacyCustomerOrderMigrationPlan } from "./lib/legacy-customer-order-migration.mjs"

const prisma = new PrismaClient()

async function main() {
  const [plan, statuses, normalizedCounts] = await Promise.all([
    loadLegacyCustomerOrderMigrationPlan(prisma),
    prisma.purchase_orders.groupBy({
      by: ["current_status"],
      _count: { _all: true },
      orderBy: { current_status: "asc" },
    }),
    Promise.all([
      prisma.customerPurchaseOrder.count(),
      prisma.customerOrderRelease.count(),
      prisma.customerOrderReleaseLine.count(),
    ]),
  ])

  console.log(JSON.stringify({
    mode: "DRY_RUN_READ_ONLY",
    legacy: {
      total: plan.rows.length,
      statuses: Object.fromEntries(statuses.map((status) => [status.current_status, status._count._all])),
      directlyOrProductMapped: plan.rows.filter((row) =>
        ["DIRECT", "PRODUCT"].includes(row.customerResolutionMethod)
      ).length,
      exactNameMapped: plan.rows.filter((row) => row.customerResolutionMethod === "EXACT_NAME").length,
      activeBomSnapshotsAvailable: plan.rows.filter((row) => row.activeBom).length,
      missingRequestedDeliveryDate: plan.rows.filter((row) => !row.order.requested_delivery_date).length,
    },
    migrationReadiness: {
      ready: plan.readyRows.length,
      blocked: plan.blockedRows.length,
      alreadyMigrated: plan.alreadyMigratedRows.length,
      blockedRows: plan.blockedRows.map((row) => ({
        legacyOrderId: row.order.id,
        legacyPoNumber: row.order.po_number,
        errors: row.errors,
      })),
    },
    normalizedTargetCounts: {
      customerPurchaseOrders: normalizedCounts[0],
      releases: normalizedCounts[1],
      releaseLines: normalizedCounts[2],
    },
    writesPerformed: 0,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Customer Order migration dry-run failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
