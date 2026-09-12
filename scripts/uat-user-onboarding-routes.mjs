import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

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

  const loginResponse = await fetch(`${baseUrl}/login`)
  assert.equal(loginResponse.status, 200)
  assert.match(await loginResponse.text(), /Welcome back/)
  console.log("PASS  Redesigned login route renders")

  const invalidActivationResponse = await fetch(
    `${baseUrl}/activate-account/not-a-valid-token`
  )
  assert.equal(invalidActivationResponse.status, 200)
  assert.match(await invalidActivationResponse.text(), /Activation link unavailable/)
  console.log("PASS  Invalid activation links receive the generic recovery page")

  const anonymousInviteResponse = await fetch(`${baseUrl}/settings/access/users/new`, {
    redirect: "manual",
  })
  assert.equal(anonymousInviteResponse.status, 302)
  assert.equal(anonymousInviteResponse.headers.get("location"), "/login")
  console.log("PASS  Signed-out users are redirected from user invitation")

  const adminCookies = await authenticate(administrator)
  const adminInviteResponse = await fetch(`${baseUrl}/settings/access/users/new`, {
    headers: { cookie: adminCookies },
  })
  assert.equal(adminInviteResponse.status, 200)
  assert.match(await adminInviteResponse.text(), /Create invitation/)
  console.log("PASS  System Administrator can open user invitation")

  const salesCookies = await authenticate(sales)
  const deniedInviteResponse = await fetch(`${baseUrl}/settings/access/users/new`, {
    headers: { cookie: salesCookies },
  })
  assert.equal(deniedInviteResponse.status, 200)
  assert.match(await deniedInviteResponse.text(), /Access restricted/)
  console.log("PASS  Sales cannot open user invitation")
}

main().catch((error) => {
  console.error("User onboarding route UAT failed.", error)
  process.exitCode = 1
})
