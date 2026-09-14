import assert from "node:assert/strict"
import { resolveBootstrapAdminConfig } from "./bootstrap-admin-policy.ts"

const baseEnvironment = {
  DATABASE_URL: "postgresql://user:secret@db.example.internal:5432/erp",
  BOOTSTRAP_ADMIN_ENVIRONMENT: "development",
  BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST: "db.example.internal",
  BOOTSTRAP_ADMIN_EMAIL: "security.owner@manufacturer.test",
  BOOTSTRAP_ADMIN_CONFIRM_EMAIL: "security.owner@manufacturer.test",
  BOOTSTRAP_ADMIN_NAME: "Security Owner",
  BOOTSTRAP_ADMIN_PASSWORD: "A-long-unique-development-passphrase!",
  BOOTSTRAP_ADMIN_REASON: "Create the first recoverable administrator.",
}

function rejects(overrides, argv = ["--confirm-environment=development"]) {
  assert.throws(() =>
    resolveBootstrapAdminConfig({ ...baseEnvironment, ...overrides }, argv)
  )
}

const valid = resolveBootstrapAdminConfig(baseEnvironment, [
  "--confirm-environment=development",
])
assert.equal(valid.deploymentEnvironment, "development")
assert.equal(valid.databaseHost, "db.example.internal")
assert.equal(valid.email, "security.owner@manufacturer.test")
assert.equal(valid.name, "Security Owner")
assert.equal(valid.password, "A-long-unique-development-passphrase!")
assert.equal(valid.reason, "Create the first recoverable administrator.")

rejects({}, [])
rejects({ BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST: "wrong.example.internal" })
rejects({ BOOTSTRAP_ADMIN_CONFIRM_EMAIL: "other@manufacturer.test" })
rejects({ BOOTSTRAP_ADMIN_EMAIL: "uat.system-admin@example.com", BOOTSTRAP_ADMIN_CONFIRM_EMAIL: "uat.system-admin@example.com" })
rejects({ BOOTSTRAP_ADMIN_PASSWORD: "too-short" })
rejects({ BOOTSTRAP_ADMIN_PASSWORD: "\u00e9".repeat(40) })
rejects({ BOOTSTRAP_ADMIN_REASON: "Too short" })
rejects({ BOOTSTRAP_ADMIN_ENVIRONMENT: "production" })

const production = resolveBootstrapAdminConfig(
  { ...baseEnvironment, BOOTSTRAP_ADMIN_ENVIRONMENT: "production" },
  ["--confirm-environment=production"]
)
assert.equal(production.deploymentEnvironment, "production")

console.log("Bootstrap administrator policy UAT passed (15 checks).")
