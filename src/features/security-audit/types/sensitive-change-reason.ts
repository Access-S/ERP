import { z } from "zod"

export const SENSITIVE_CHANGE_REASON_MIN_LENGTH = 10
export const SENSITIVE_CHANGE_REASON_MAX_LENGTH = 256

export const sensitiveChangeReasonSchema = z
  .string()
  .trim()
  .min(
    SENSITIVE_CHANGE_REASON_MIN_LENGTH,
    `Enter a reason of at least ${SENSITIVE_CHANGE_REASON_MIN_LENGTH} characters.`
  )
  .max(
    SENSITIVE_CHANGE_REASON_MAX_LENGTH,
    `Reason cannot exceed ${SENSITIVE_CHANGE_REASON_MAX_LENGTH} characters.`
  )
  .transform((value) => value.replace(/\s+/g, " "))

export function isSensitiveChangeReasonReady(value: string) {
  const length = value.trim().length
  return (
    length >= SENSITIVE_CHANGE_REASON_MIN_LENGTH &&
    length <= SENSITIVE_CHANGE_REASON_MAX_LENGTH
  )
}
