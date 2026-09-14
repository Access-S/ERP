import "server-only"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  LOGIN_BLOCK_DURATION_MS,
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MS,
} from "../config/auth-security-policy"

type LoginThrottleClient = Pick<Prisma.TransactionClient, "user">

export type LoginThrottleState = {
  failedLoginAttempts: number
  failedLoginWindowStart: Date | null
  loginBlockedUntil: Date | null
}

async function registerFailedPasswordWithClient(
  userId: string,
  now: Date,
  client: LoginThrottleClient
) {
  const windowCutoff = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS)

  await client.user.updateMany({
    where: {
      id: userId,
      OR: [
        { failedLoginWindowStart: null },
        { failedLoginWindowStart: { lt: windowCutoff } },
        { loginBlockedUntil: { lte: now } },
      ],
    },
    data: {
      failedLoginAttempts: 0,
      failedLoginWindowStart: now,
      loginBlockedUntil: null,
    },
  })

  const failedState = await client.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: {
      failedLoginAttempts: true,
      failedLoginWindowStart: true,
      loginBlockedUntil: true,
    },
  })

  if (failedState.failedLoginAttempts < LOGIN_FAILURE_THRESHOLD) {
    return { ...failedState, becameBlocked: false }
  }

  const loginBlockedUntil = new Date(now.getTime() + LOGIN_BLOCK_DURATION_MS)
  const blockedState = await client.user.update({
    where: { id: userId },
    data: { loginBlockedUntil },
    select: {
      failedLoginAttempts: true,
      failedLoginWindowStart: true,
      loginBlockedUntil: true,
    },
  })

  return { ...blockedState, becameBlocked: true }
}

export async function registerFailedPassword(
  userId: string,
  now = new Date()
) {
  return prisma.$transaction((transaction) =>
    registerFailedPasswordWithClient(userId, now, transaction)
  )
}
