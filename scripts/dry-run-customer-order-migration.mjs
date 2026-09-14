import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function candidateCustomer(order) {
  const direct = order.customer_id
  const fromProduct = order.products?.customer_id ?? null

  if (direct && fromProduct && direct !== fromProduct) {
    return { customerId: null, method: "CONFLICT", reason: "Order and Product customers differ" }
  }
  if (direct) return { customerId: direct, method: "DIRECT", reason: null }
  if (fromProduct) return { customerId: fromProduct, method: "PRODUCT", reason: null }
  return { customerId: null, method: "MANUAL", reason: "No Customer relationship is available" }
}

async function main() {
  const [orders, statuses, normalizedCounts] = await Promise.all([
    prisma.purchase_orders.findMany({
      select: {
        id: true,
        po_number: true,
        customer_id: true,
        requested_delivery_date: true,
        products: { select: { product_code: true, customer_id: true } },
      },
      orderBy: [{ po_number: "asc" }, { id: "asc" }],
    }),
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

  const mapped = orders.map((order) => ({
    legacyOrderId: order.id,
    legacyPoNumber: order.po_number,
    productCode: order.products?.product_code ?? null,
    hasRequestedDeliveryDate: order.requested_delivery_date !== null,
    ...candidateCustomer(order),
  }))
  const manualReview = mapped.filter((order) => !order.customerId)

  console.log(JSON.stringify({
    mode: "DRY_RUN_READ_ONLY",
    legacy: {
      total: orders.length,
      statuses: Object.fromEntries(
        statuses.map((status) => [status.current_status, status._count._all])
      ),
      safeCustomerMappings: mapped.length - manualReview.length,
      manualReviewCount: manualReview.length,
      missingRequestedDeliveryDate: mapped.filter((order) => !order.hasRequestedDeliveryDate).length,
    },
    normalizedTargetCounts: {
      customerPurchaseOrders: normalizedCounts[0],
      releases: normalizedCounts[1],
      releaseLines: normalizedCounts[2],
    },
    manualReview,
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

