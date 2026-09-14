import type { Prisma } from "@prisma/client"

export const CUSTOMER_ORDER_COUNTER_KEY = "CUSTOMER_ORDER"
export const CUSTOMER_RELEASE_COUNTER_KEY = "CUSTOMER_RELEASE"

type CustomerOrderNumberingClient = Pick<
  Prisma.TransactionClient,
  "customerOrderNumberCounter"
>

export function formatCustomerOrderNumber(
  kind: "ORDER" | "RELEASE",
  sequence: bigint,
  date: Date = new Date()
): string {
  if (sequence <= BigInt(0)) throw new RangeError("Customer Order sequence must be positive.")
  const prefix = kind === "ORDER" ? "CO" : "COR"
  const year = date.getUTCFullYear()
  return `${prefix}-${year}-${sequence.toString().padStart(6, "0")}`
}

export async function allocateCustomerOrderNumber(
  client: CustomerOrderNumberingClient,
  kind: "ORDER" | "RELEASE",
  date: Date = new Date()
): Promise<string> {
  const key = kind === "ORDER" ? CUSTOMER_ORDER_COUNTER_KEY : CUSTOMER_RELEASE_COUNTER_KEY
  const counter = await client.customerOrderNumberCounter.upsert({
    where: { key },
    update: { lastSequence: { increment: 1 } },
    create: { key, lastSequence: 1 },
    select: { lastSequence: true },
  })

  return formatCustomerOrderNumber(kind, counter.lastSequence, date)
}
