import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import {
  AUTH_SESSION_IDLE_SECONDS,
  LOGIN_FAILURE_THRESHOLD,
} from "../src/features/auth/config/auth-security-policy.ts"

const prisma = new PrismaClient()
const baseUrl = (process.env.UAT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const credentialsPath = resolve(process.cwd(), "Data files", "uat-role-credentials.json")

function addResponseCookies(cookieJar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0]
    const separator = pair.indexOf("=")
    if (separator > 0) cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function serializeCookies(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
}

function parseCookies(serialized) {
  return new Map(
    serialized.split(";").flatMap((pair) => {
      const trimmed = pair.trim()
      const separator = trimmed.indexOf("=")
      return separator > 0 ? [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]] : []
    })
  )
}

async function submitCredentials(email, password) {
  const cookieJar = new Map()
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  assert.equal(csrfResponse.ok, true, "CSRF endpoint must be available")
  addResponseCookies(cookieJar, csrfResponse)
  const { csrfToken } = await csrfResponse.json()

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: serializeCookies(cookieJar),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${baseUrl}/`,
    }),
  })
  const setCookies = response.headers.getSetCookie()
  addResponseCookies(cookieJar, response)
  return { response, cookies: serializeCookies(cookieJar), setCookies }
}

async function signOutSession(serializedCookies) {
  const cookieJar = parseCookies(serializedCookies)
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { cookie: serializeCookies(cookieJar) },
  })
  assert.equal(csrfResponse.ok, true, "authenticated CSRF endpoint must be available")
  addResponseCookies(cookieJar, csrfResponse)
  const { csrfToken } = await csrfResponse.json()

  return fetch(`${baseUrl}/api/auth/signout`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: serializeCookies(cookieJar),
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${baseUrl}/login` }),
  })
}

function assertCredentialFailure(result) {
  assert.ok([302, 303].includes(result.response.status))
  assert.match(result.response.headers.get("location") ?? "", /error=/)
}

async function waitForAuditEvent(eventType, targetId, startedAt) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const event = await prisma.securityAuditEvent.findFirst({
      where: { eventType, targetId, occurredAt: { gte: startedAt } },
      orderBy: { occurredAt: "desc" },
    })
    if (event) return event
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  return null
}

async function main() {
  let checks = 0
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"))
  const account = credentials.accounts.find(
    (candidate) => candidate.roleKey === "SALES_CUSTOMER_SERVICE"
  )
  assert.ok(account, "Sales UAT account must exist")

  const user = await prisma.user.findUnique({
    where: { normalizedEmail: account.email.toLowerCase() },
    select: {
      id: true,
      failedLoginAttempts: true,
      failedLoginWindowStart: true,
      loginBlockedUntil: true,
    },
  })
  assert.ok(user, "Sales UAT user must exist in the database")
  const originalThrottle = {
    failedLoginAttempts: user.failedLoginAttempts,
    failedLoginWindowStart: user.failedLoginWindowStart,
    loginBlockedUntil: user.loginBlockedUntil,
  }
  const startedAt = new Date()

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        failedLoginWindowStart: null,
        loginBlockedUntil: null,
      },
    })

    for (let attempt = 1; attempt <= LOGIN_FAILURE_THRESHOLD; attempt += 1) {
      const result = await submitCredentials(
        account.email,
        `Wrong-UAT-Password-${attempt}!`
      )
      assertCredentialFailure(result)
      checks += 2
    }

    const blockedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { failedLoginAttempts: true, loginBlockedUntil: true, status: true },
    })
    assert.equal(blockedUser.failedLoginAttempts, LOGIN_FAILURE_THRESHOLD)
    assert.ok(blockedUser.loginBlockedUntil?.getTime() > Date.now())
    assert.equal(blockedUser.status, "ACTIVE", "temporary throttling must not change account status")
    checks += 3

    const blockedCorrectPassword = await submitCredentials(account.email, account.password)
    assertCredentialFailure(blockedCorrectPassword)
    checks += 2

    const rateLimitedEvent = await waitForAuditEvent(
      "auth.login.rate_limited",
      user.id,
      startedAt
    )
    assert.ok(rateLimitedEvent, "throttle activation must be audited")
    assert.equal(rateLimitedEvent.outcome, "DENIED")
    assert.equal(rateLimitedEvent.reasonCode, "RATE_LIMITED")
    assert.equal(rateLimitedEvent.metadata.failureCount, LOGIN_FAILURE_THRESHOLD)
    assert.equal(JSON.stringify(rateLimitedEvent).includes(account.password), false)
    checks += 5

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 2,
        failedLoginWindowStart: new Date(),
        loginBlockedUntil: null,
      },
    })

    const successfulLogin = await submitCredentials(account.email, account.password)
    assert.ok([302, 303].includes(successfulLogin.response.status))
    assert.equal(
      (successfulLogin.response.headers.get("location") ?? "").includes("error="),
      false
    )
    const sessionCookie = successfulLogin.setCookies.find((cookie) =>
      cookie.includes("authjs.session-token=")
    )
    assert.ok(sessionCookie, "successful login must issue a session cookie")
    const expiryText = /Expires=([^;]+)/i.exec(sessionCookie)?.[1]
    assert.ok(expiryText, "session cookie must carry an explicit expiry")
    const expirySeconds = (new Date(expiryText).getTime() - Date.now()) / 1000
    assert.ok(expirySeconds > AUTH_SESSION_IDLE_SECONDS - 15)
    assert.ok(expirySeconds <= AUTH_SESSION_IDLE_SECONDS + 15)
    checks += 6

    const clearedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        failedLoginAttempts: true,
        failedLoginWindowStart: true,
        loginBlockedUntil: true,
      },
    })
    assert.equal(clearedUser.failedLoginAttempts, 0)
    assert.equal(clearedUser.failedLoginWindowStart, null)
    assert.equal(clearedUser.loginBlockedUntil, null)
    checks += 3

    const signOutResponse = await signOutSession(successfulLogin.cookies)
    assert.ok([302, 303].includes(signOutResponse.status))
    const logoutEvent = await waitForAuditEvent("auth.logout.succeeded", user.id, startedAt)
    assert.ok(logoutEvent, "explicit logout must be audited")
    assert.equal(logoutEvent.actorUserId, user.id)
    checks += 3

    console.log(
      `Auth session route UAT passed (${checks} checks; throttle state restored, immutable audit evidence retained).`
    )
  } finally {
    await prisma.user.update({
      where: { id: user.id },
      data: originalThrottle,
    })
  }
}

main()
  .catch((error) => {
    console.error("Auth session route UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
