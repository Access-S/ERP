import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const baseUrl = (process.env.UAT_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
)
const credentialsPath = resolve(
  process.cwd(),
  "Data files",
  "uat-role-credentials.json"
)

function addResponseCookies(cookieJar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0]
    const separator = pair.indexOf("=")
    if (separator < 1) continue
    cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function serializeCookies(cookieJar) {
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

async function verifyLogin(account) {
  const cookieJar = new Map()
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  if (!csrfResponse.ok) {
    throw new Error(`CSRF request returned HTTP ${csrfResponse.status}`)
  }
  addResponseCookies(cookieJar, csrfResponse)
  const { csrfToken } = await csrfResponse.json()

  const callbackResponse = await fetch(
    `${baseUrl}/api/auth/callback/credentials`,
    {
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
        callbackUrl: `${baseUrl}/dashboard`,
      }),
    }
  )
  addResponseCookies(cookieJar, callbackResponse)

  const redirectLocation = callbackResponse.headers.get("location") ?? ""
  if (
    ![302, 303].includes(callbackResponse.status) ||
    redirectLocation.includes("error=")
  ) {
    const safeRedirect = redirectLocation || "(missing Location header)"
    throw new Error(
      `Credentials callback returned HTTP ${callbackResponse.status}: ${safeRedirect}`
    )
  }

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: serializeCookies(cookieJar) },
  })
  if (!sessionResponse.ok) {
    throw new Error(`Session request returned HTTP ${sessionResponse.status}`)
  }

  const session = await sessionResponse.json()
  if (session?.user?.email !== account.email) {
    throw new Error("Authenticated session returned the wrong user")
  }
  if (session?.user?.role !== account.roleKey) {
    throw new Error("Authenticated session returned the wrong role")
  }
}

async function main() {
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"))
  if (!Array.isArray(credentials.accounts) || credentials.accounts.length === 0) {
    throw new Error(
      "No UAT credentials found. Run npm run provision:uat-users first."
    )
  }

  let failed = false
  for (const account of credentials.accounts) {
    try {
      await verifyLogin(account)
      console.log(`PASS  ${account.roleName} (${account.email})`)
    } catch (error) {
      failed = true
      console.error(
        `FAIL  ${account.roleName} (${account.email}):`,
        error instanceof Error ? error.message : error
      )
    }
  }

  if (failed) process.exitCode = 1
}

main().catch((error) => {
  console.error("UAT login verification failed.", error)
  process.exitCode = 1
})
