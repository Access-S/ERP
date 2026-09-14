import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"

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

async function submitCredentials(email, password) {
  const cookieJar = new Map()
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  assert.equal(csrfResponse.ok, true, "CSRF endpoint must be available")
  addResponseCookies(cookieJar, csrfResponse)
  const { csrfToken } = await csrfResponse.json()

  const callbackResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
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
  addResponseCookies(cookieJar, callbackResponse)
  return { response: callbackResponse, cookies: serializeCookies(cookieJar) }
}

async function authenticate(account) {
  const result = await submitCredentials(account.email, account.password)
  assert.ok([302, 303].includes(result.response.status), "UAT account must authenticate")
  assert.equal(
    (result.response.headers.get("location") ?? "").includes("error="),
    false,
    "UAT account login must not redirect to an error"
  )
  return result.cookies
}

async function loadGeneratedAuditEvents(startedAt) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const events = await prisma.securityAuditEvent.findMany({
      where: { occurredAt: { gte: startedAt } },
      orderBy: { occurredAt: "asc" },
    })

    if (
      events.some((event) => event.eventType === "auth.audit.viewed") &&
      events.some((event) => event.eventType === "auth.access.denied") &&
      events.some((event) => event.eventType === "auth.login.failed")
    ) {
      return events
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }

  return prisma.securityAuditEvent.findMany({
    where: { occurredAt: { gte: startedAt } },
    orderBy: { occurredAt: "asc" },
  })
}

async function main() {
  let checks = 0
  const startedAt = new Date()
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"))
  const administrator = credentials.accounts.find(
    (account) => account.roleKey === "SYSTEM_ADMIN"
  )
  const sales = credentials.accounts.find(
    (account) => account.roleKey === "SALES_CUSTOMER_SERVICE"
  )
  assert.ok(administrator && sales, "Required UAT accounts must exist")
  const [administratorUser, salesUser] = await Promise.all([
    prisma.user.findUnique({
      where: { normalizedEmail: administrator.email.toLowerCase() },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { normalizedEmail: sales.email.toLowerCase() },
      select: { id: true },
    }),
  ])
  assert.ok(administratorUser && salesUser, "Required UAT users must exist in the database")

  const adminCookies = await authenticate(administrator)
  const auditResponse = await fetch(`${baseUrl}/settings/access/audit`, {
    headers: { cookie: adminCookies },
  })
  assert.equal(auditResponse.status, 200)
  const auditHtml = await auditResponse.text()
  assert.match(auditHtml, /Security monitoring/)
  assert.match(auditHtml, /Authentication &amp; sessions/)
  assert.match(auditHtml, /Roles &amp; permissions/)
  assert.match(auditHtml, /User lifecycle/)
  assert.match(auditHtml, /Security oversight/)
  assert.match(auditHtml, /Failed sign-ins/)
  assert.match(auditHtml, /All security activity/)
  assert.match(auditHtml, /Investigation filters/)
  checks += 9

  const salesCookies = await authenticate(sales)
  const deniedResponse = await fetch(`${baseUrl}/settings/access/audit`, {
    headers: { cookie: salesCookies },
  })
  assert.equal(deniedResponse.status, 200)
  assert.match(await deniedResponse.text(), /Access restricted/)
  checks += 2

  const failedLogin = await submitCredentials(
    sales.email,
    "Definitely-Wrong-UAT-Password!"
  )
  assert.ok([302, 303].includes(failedLogin.response.status))
  assert.match(failedLogin.response.headers.get("location") ?? "", /error=/)
  checks += 2

  const events = await loadGeneratedAuditEvents(startedAt)
  assert.ok(
    events.some(
      (event) =>
        event.eventType === "auth.audit.viewed" &&
        event.actorUserId === administratorUser.id
    ),
    "authorized audit view must be recorded"
  )
  assert.ok(
    events.some(
      (event) =>
        event.eventType === "auth.access.denied" &&
        event.actorUserId === salesUser.id &&
        event.targetId === "admin.audit.view"
    ),
    "denied audit view must be recorded"
  )
  assert.ok(
    events.some(
      (event) =>
        event.eventType === "auth.login.failed" &&
        event.actorEmailSnapshot === sales.email.toLowerCase()
    ),
    "failed login must be recorded with a normalized identifier snapshot"
  )
  assert.equal(
    JSON.stringify(events).includes(sales.password),
    false,
    "audit events must not contain the submitted password"
  )
  checks += 4

  console.log(
    `Security audit route UAT passed (${checks} checks; generated events retained as immutable development audit evidence).`
  )
}

main()
  .catch((error) => {
    console.error("Security audit route UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
