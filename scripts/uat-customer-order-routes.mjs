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
      callbackUrl: `${baseUrl}/customer-orders`,
    }),
  })
  addResponseCookies(cookieJar, callbackResponse)
  assert.ok([302, 303].includes(callbackResponse.status), `${account.roleKey} must authenticate`)
  assert.equal(
    (callbackResponse.headers.get("location") ?? "").includes("error="),
    false,
    `${account.roleKey} login must not redirect to an error`
  )
  return serializeCookies(cookieJar)
}

async function getPage(path, cookies) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: { cookie: cookies },
  })
  assert.equal(response.status, 200, `${path} must return 200`)
  return response.text()
}

async function main() {
  let checks = 0
  const { accounts } = JSON.parse(await readFile(credentialsPath, "utf8"))
  const findAccount = (roleKey) => {
    const account = accounts.find((candidate) => candidate.roleKey === roleKey)
    assert.ok(account, `Missing UAT account ${roleKey}`)
    return account
  }

  const customerServiceCookies = await authenticate(findAccount("SALES_CUSTOMER_SERVICE"))
  const customerServiceList = await getPage("/customer-orders", customerServiceCookies)
  assert.match(customerServiceList, /Customer Orders/)
  assert.match(customerServiceList, /New Customer PO/)
  assert.doesNotMatch(customerServiceList, /Access restricted/)
  const createPage = await getPage("/customer-orders/new", customerServiceCookies)
  assert.match(createPage, /Standard Customer PO/)
  assert.match(createPage, /Blanket Customer PO/)
  const standardPage = await getPage("/customer-orders/new/standard", customerServiceCookies)
  assert.match(standardPage, /New Standard Customer PO/)
  assert.match(standardPage, /Record the Customer document exactly as received/)
  const blanketPage = await getPage("/customer-orders/new/blanket", customerServiceCookies)
  assert.match(blanketPage, /New Blanket Customer PO/)
  assert.match(blanketPage, /Blanket PO authority/)
  checks += 9

  const plannerCookies = await authenticate(findAccount("PRODUCTION_PLANNER"))
  const plannerList = await getPage("/customer-orders", plannerCookies)
  assert.match(plannerList, /Customer Orders/)
  assert.doesNotMatch(plannerList, /New Customer PO/)
  const plannerCreatePage = await getPage("/customer-orders/new", plannerCookies)
  assert.match(plannerCreatePage, /Access restricted/)
  const plannerBlanketPage = await getPage("/customer-orders/new/blanket", plannerCookies)
  assert.match(plannerBlanketPage, /Access restricted/)
  checks += 4

  const financeCookies = await authenticate(findAccount("FINANCE_ACCOUNTS"))
  const financeList = await getPage("/customer-orders", financeCookies)
  assert.match(financeList, /Access restricted/)
  assert.doesNotMatch(financeList, /New Customer PO/)
  checks += 2

  console.log(`Customer Order route UAT passed (${checks} checks).`)
}

main().catch((error) => {
  console.error("Customer Order route UAT failed.", error)
  process.exitCode = 1
})
