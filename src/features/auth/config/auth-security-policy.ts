export const AUTH_SESSION_IDLE_SECONDS = 60 * 60
export const AUTH_SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60

export const LOGIN_FAILURE_THRESHOLD = 5
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000

type SessionTimingToken = {
  iat?: unknown
  sessionStartedAt?: unknown
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null
}

export function resolveSessionStartedAt(
  token: SessionTimingToken,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  return (
    positiveInteger(token.sessionStartedAt) ??
    positiveInteger(token.iat) ??
    nowSeconds
  )
}

export function getAbsoluteSessionAgeSeconds(
  sessionStartedAt: number,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  return Math.max(0, nowSeconds - sessionStartedAt)
}

export function isAbsoluteSessionExpired(
  sessionStartedAt: number,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  return (
    getAbsoluteSessionAgeSeconds(sessionStartedAt, nowSeconds) >=
    AUTH_SESSION_ABSOLUTE_SECONDS
  )
}

export function isLoginTemporarilyBlocked(
  blockedUntil: Date | null | undefined,
  now = new Date()
) {
  return Boolean(blockedUntil && blockedUntil.getTime() > now.getTime())
}

export function getLoginRetryAfterSeconds(
  blockedUntil: Date,
  now = new Date()
) {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000))
}
