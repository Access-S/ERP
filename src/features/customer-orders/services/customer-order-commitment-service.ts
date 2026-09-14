import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { commitCustomerOrderReleaseInTransaction } from "./customer-order-commitment-policy"

const MAX_SERIALIZATION_ATTEMPTS = 3

export async function commitCustomerOrderRelease(releaseId: string, now: Date = new Date()) {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        (tx) => commitCustomerOrderReleaseInTransaction(tx, releaseId, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 10_000,
        }
      )
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
      if (!retryable || attempt === MAX_SERIALIZATION_ATTEMPTS) throw error
    }
  }

  throw new Error("Customer Order commitment retry loop ended unexpectedly.")
}

