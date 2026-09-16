import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")
const counterKey = "CUSTOMER_ORDER"

function formatNumber(sequence) {
  if (sequence < 1 || sequence > 99_999) {
    throw new Error("The five-digit Customer Order number range is exhausted.")
  }
  return String(sequence).padStart(5, "0")
}

async function loadPlan() {
  const [orders, counter] = await Promise.all([
    prisma.customerPurchaseOrder.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        internalOrderNumber: true,
        customerPoNumber: true,
        createdAt: true,
      },
    }),
    prisma.customerOrderNumberCounter.findUnique({
      where: { key: counterKey },
      select: { lastSequence: true },
    }),
  ])

  if (orders.length > 99_999) {
    throw new Error(`Cannot fit ${orders.length} Customer Orders in a five-digit range.`)
  }
  return {
    counter,
    rows: orders.map((order, index) => ({
      ...order,
      desiredNumber: formatNumber(index + 1),
      needsChange: order.internalOrderNumber !== formatNumber(index + 1),
    })),
  }
}

async function main() {
  const plan = await loadPlan()
  const changes = plan.rows.filter((row) => row.needsChange)
  const report = {
    mode: apply ? "APPLY" : "DRY_RUN_READ_ONLY",
    orderCount: plan.rows.length,
    changesRequired: changes.length,
    currentCounter: plan.counter?.lastSequence.toString() ?? null,
    resultingCounter: String(plan.rows.length),
    firstChanges: changes.slice(0, 5).map((row) => ({
      customerPoNumber: row.customerPoNumber,
      previousNumber: row.internalOrderNumber,
      nextNumber: row.desiredNumber,
    })),
    ...(apply ? {} : { writesPerformed: 0 }),
  }
  console.log(JSON.stringify(report, null, 2))
  if (!apply) return

  await prisma.$transaction(async (tx) => {
    for (const row of changes) {
      await tx.customerPurchaseOrder.update({
        where: { id: row.id },
        data: { internalOrderNumber: `TMP-${row.id}` },
      })
    }
    for (const row of changes) {
      await tx.customerPurchaseOrder.update({
        where: { id: row.id },
        data: { internalOrderNumber: row.desiredNumber },
      })
      await tx.businessAuditEvent.create({
        data: {
          eventType: "customer_order.internal_number_reassigned",
          outcome: "SUCCESS",
          targetType: "CUSTOMER_ORDER",
          targetId: row.id,
          correlationId: crypto.randomUUID(),
          metadata: {
            previousInternalOrderNumber: row.internalOrderNumber,
            internalOrderNumber: row.desiredNumber,
          },
        },
      })
    }
    await tx.customerOrderNumberCounter.upsert({
      where: { key: counterKey },
      update: { lastSequence: BigInt(plan.rows.length) },
      create: { key: counterKey, lastSequence: BigInt(plan.rows.length) },
    })
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  })

  const after = await loadPlan()
  const invalidRows = after.rows.filter((row) => row.needsChange)
  if (invalidRows.length > 0 || after.counter?.lastSequence !== BigInt(after.rows.length)) {
    throw new Error("Customer Order number reconciliation failed.")
  }
  console.log(JSON.stringify({
    mode: "APPLY_COMPLETE",
    updated: changes.length,
    firstNumber: after.rows[0]?.internalOrderNumber ?? null,
    lastNumber: after.rows.at(-1)?.internalOrderNumber ?? null,
    counter: after.counter?.lastSequence.toString() ?? null,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Customer Order renumber failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
