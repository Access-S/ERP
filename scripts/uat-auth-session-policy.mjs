import assert from "node:assert/strict"
import {
  AUTH_SESSION_ABSOLUTE_SECONDS,
  AUTH_SESSION_IDLE_SECONDS,
  LOGIN_BLOCK_DURATION_MS,
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MS,
  getAbsoluteSessionAgeSeconds,
  getLoginRetryAfterSeconds,
  isAbsoluteSessionExpired,
  isLoginTemporarilyBlocked,
  resolveSessionStartedAt,
} from "../src/features/auth/config/auth-security-policy.ts"

let checks = 0

assert.equal(AUTH_SESSION_IDLE_SECONDS, 60 * 60)
assert.equal(AUTH_SESSION_ABSOLUTE_SECONDS, 12 * 60 * 60)
assert.equal(LOGIN_FAILURE_THRESHOLD, 5)
assert.equal(LOGIN_FAILURE_WINDOW_MS, 15 * 60 * 1000)
assert.equal(LOGIN_BLOCK_DURATION_MS, 15 * 60 * 1000)
checks += 5

assert.equal(
  resolveSessionStartedAt({ sessionStartedAt: 1_000, iat: 2_000 }, 3_000),
  1_000
)
assert.equal(resolveSessionStartedAt({ iat: 2_000 }, 3_000), 2_000)
assert.equal(resolveSessionStartedAt({}, 3_000), 3_000)
checks += 3

assert.equal(getAbsoluteSessionAgeSeconds(1_000, 1_900), 900)
assert.equal(isAbsoluteSessionExpired(1_000, 1_000 + AUTH_SESSION_ABSOLUTE_SECONDS - 1), false)
assert.equal(isAbsoluteSessionExpired(1_000, 1_000 + AUTH_SESSION_ABSOLUTE_SECONDS), true)
checks += 3

const now = new Date("2026-09-14T00:00:00.000Z")
const future = new Date(now.getTime() + 30_001)
assert.equal(isLoginTemporarilyBlocked(future, now), true)
assert.equal(isLoginTemporarilyBlocked(now, now), false)
assert.equal(isLoginTemporarilyBlocked(null, now), false)
assert.equal(getLoginRetryAfterSeconds(future, now), 31)
checks += 4

console.log(`Auth session policy UAT passed (${checks} checks).`)
