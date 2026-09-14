import { Prisma } from "@prisma/client"

import type { DecimalInput } from "./customer-order-validation.ts"

export type BlanketBalanceInput = {
  originalAuthorizedValue: DecimalInput
  amendmentValues: readonly DecimalInput[]
  committedReleaseValues: readonly DecimalInput[]
}

export type BlanketBalance = {
  originalAuthorizedValue: Prisma.Decimal
  amendmentValue: Prisma.Decimal
  currentAuthorizedValue: Prisma.Decimal
  committedValue: Prisma.Decimal
  availableValue: Prisma.Decimal
}

function decimal(value: DecimalInput, field: string): Prisma.Decimal {
  let parsed: Prisma.Decimal
  try {
    parsed = new Prisma.Decimal(value)
  } catch {
    throw new RangeError(`${field} must be a valid decimal value.`)
  }
  if (!parsed.isFinite()) throw new RangeError(`${field} must be a finite decimal value.`)
  return parsed
}

export function calculateBlanketBalance(input: BlanketBalanceInput): BlanketBalance {
  const original = decimal(input.originalAuthorizedValue, "Original authorised value")
  if (original.isNegative()) {
    throw new RangeError("Original authorised value cannot be negative.")
  }

  const amendmentValue = input.amendmentValues.reduce<Prisma.Decimal>((total, value) => {
    const topUp = decimal(value, "Blanket amendment")
    if (!topUp.greaterThan(0)) throw new RangeError("Blanket amendments must be positive top-ups.")
    return total.plus(topUp)
  }, new Prisma.Decimal(0))

  const committedValue = input.committedReleaseValues.reduce<Prisma.Decimal>((total, value) => {
    const commitment = decimal(value, "Committed release value")
    if (commitment.isNegative()) throw new RangeError("Committed release value cannot be negative.")
    return total.plus(commitment)
  }, new Prisma.Decimal(0))

  const currentAuthorizedValue = original.plus(amendmentValue)

  return {
    originalAuthorizedValue: original,
    amendmentValue,
    currentAuthorizedValue,
    committedValue,
    availableValue: currentAuthorizedValue.minus(committedValue),
  }
}

export function canCommitBlanketRelease(
  balance: BlanketBalance,
  releaseValue: DecimalInput
): boolean {
  const proposed = decimal(releaseValue, "Release value")
  if (proposed.isNegative()) throw new RangeError("Release value cannot be negative.")
  return proposed.lessThanOrEqualTo(balance.availableValue)
}
