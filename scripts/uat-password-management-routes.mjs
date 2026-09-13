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

async function authenticate(account) {
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
      email: account.email,
      password: account.password,
      callbackUrl: `${baseUrl}/`,
    }),
  })
  addResponseCookies(cookieJar, callbackResponse)
  assert.ok([302, 303].includes(callbackResponse.status), "UAT account must authenticate")
  return serializeCookies(cookieJar)
}

async function main() {
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"))
  const administrator = credentials.accounts.find(
    (account) => account.roleKey === "SYSTEM_ADMIN"
  )
  const sales = credentials.accounts.find(
    (account) => account.roleKey === "SALES_CUSTOMER_SERVICE"
  )
  assert.ok(administrator && sales, "Required UAT accounts must exist")

  const anonymousSecurity = await fetch(`${baseUrl}/settings/account/security`, {
    redirect: "manual",
  })
  assert.equal(anonymousSecurity.status, 302)
  assert.equal(anonymousSecurity.headers.get("location"), "/login")
  console.log("PASS  Signed-out users are redirected from Account security")

  const invalidReset = await fetch(`${baseUrl}/reset-password/not-a-valid-token`)
  assert.equal(invalidReset.status, 200)
  assert.match(await invalidReset.text(), /Password reset link unavailable/)
  console.log("PASS  Invalid reset links receive the generic recovery page")

  const salesCookies = await authenticate(sales)
  const salesSecurity = await fetch(`${baseUrl}/settings/account/security`, {
    headers: { cookie: salesCookies },
  })
  assert.equal(salesSecurity.status, 200)
  assert.match(await salesSecurity.text(), /Change password/)
  console.log("PASS  Active users can open their own Account security page")

  const targetUser = await prisma.user.findUnique({
    where: { normalizedEmail: sales.email.toLowerCase() },
    select: { id: true },
  })
  assert.ok(targetUser, "Sales UAT user must exist")

  const adminCookies = await authenticate(administrator)
  const managedUser = await fetch(`${baseUrl}/settings/access/users/${targetUser.id}`, {
    headers: { cookie: adminCookies },
  })
  assert.equal(managedUser.status, 200)
  const managedUserHtml = await managedUser.text()
  assert.match(managedUserHtml, /Password recovery/)
  assert.match(managedUserHtml, /Create password reset link/)
  console.log("PASS  System Administrator sees password recovery for an active user")

  const resetCount = await prisma.passwordResetToken.count()
  assert.ok(Number.isInteger(resetCount))
  console.log("PASS  Password reset storage is queryable")
}

main()
  .catch((error) => {
    console.error("Password management route UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
