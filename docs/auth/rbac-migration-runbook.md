# RBAC Foundation Migration Runbook

Status: Environment-safe bootstrap and development migration procedure verified
Owner: Engineering
Last updated: 2026-09-14

## 1. Purpose

This runbook applies the normalized authorization foundation safely and verifies
that existing users remain recoverable. It covers migration
`20260909170000_add_auth_rbac_foundation`, the system-role seed, and the
authorization audit.

The migration is additive. It intentionally retains `users.role`, the existing
password hashes, and every user ID while the application moves to normalized
authorization.

## 2. Pre-deployment checks

Run from the project root with the intended database configured in `.env`:

```powershell
npm run audit:auth
npx prisma migrate status
npx prisma validate
```

Before migration, `audit:auth` may report that the authorization tables are not
installed. It must still report:

- Zero normalized-email duplicates.
- Zero unmapped legacy roles.
- Only expected aggregate user and role-label counts; it never prints emails or
  password data.

Stop if either compatibility count is non-zero. Resolve the data deliberately;
do not weaken or bypass the preflight checks.

## 3. Apply and seed

```powershell
npx prisma migrate deploy
npx prisma generate
npm run seed:auth
```

`migrate deploy` applies schema migrations but does not run seeds. The separate
seed command is required. The seed:

- Upserts the canonical system roles and permissions.
- Adds the canonical role grants without deleting unrelated custom data.
- Maps recognized legacy role labels to normalized assignments.
- Refuses the entire transaction if any legacy role is unknown.
- Is safe to run repeatedly.

## 4. Post-deployment verification

```powershell
npm run seed:auth
npm run audit:auth
npm run uat:auth-core
npm run uat:auth-database
npx prisma migrate status
npm run uat:master-data
npm run build
```

The second seed run proves idempotency. The audit must report:

- 11 expected active system roles.
- 72 expected active permissions.
- No missing, unexpected, or inactive system roles.
- No missing or inactive canonical permissions.
- No missing or unexpected grants on system roles.
- No users without at least one normalized role.
- No active roles without permissions.
- No non-normalized stored login emails.

Counts of assignments may grow as users are added; the invariant checks are the
release gate.

## 5. Safe retry behaviour

If the schema migration succeeds but the seed fails:

1. Keep the application on code that still understands `users.role`.
2. Correct the unknown legacy role or registry problem.
3. Rerun `npm run seed:auth`.
4. Rerun `npm run audit:auth` before deploying permission enforcement.

Do not remove `users.role` merely because the new tables exist. The seed is
transactional, so a failed seed must not leave a partially processed user-role
mapping.

## 6. Recovery guidance

For an additive migration failure:

1. Capture the Prisma error and inspect migration status.
2. Inspect the actual schema before using `prisma migrate resolve`.
3. Prefer a corrective forward migration when any part was applied.
4. Restore from the environment's database backup only if data was actually
   damaged and the restoration impact has been approved.
5. Never use `prisma migrate reset`, `db push --force-reset`, or manual broad
   table deletion against a shared or production database.

The operational fallback remains the unchanged legacy authorization path:
existing mutations continue using authenticated-session checks and the
compatibility `users.role` field until Phase 3 adopts normalized permissions
at each module boundary.

## 7. Bootstrap administrator

Run the bootstrap only after the role seed and provide values through protected
environment configuration:

```powershell
$env:BOOTSTRAP_ADMIN_ENVIRONMENT="development"
$env:BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST="your-confirmed-database-host"
$env:BOOTSTRAP_ADMIN_EMAIL="authorised-address@your-company.test"
$env:BOOTSTRAP_ADMIN_CONFIRM_EMAIL="authorised-address@your-company.test"
$env:BOOTSTRAP_ADMIN_NAME="Authorised Administrator"
$env:BOOTSTRAP_ADMIN_PASSWORD="use-a-password-manager-generated-secret"
$env:BOOTSTRAP_ADMIN_REASON="Create the first recoverable administrator"
npm run bootstrap:admin -- --confirm-environment=development
```

Replace `development` with `staging` or `production` only when that is the
verified target. Copy only the hostname portion of `DATABASE_URL` into
`BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST`; never copy the password or complete
URL into documentation or screenshots.

Do not put these values into Git-tracked files or command screenshots. The
script requires an exact environment flag, database-host match, repeated email,
12-to-72-byte password, and retained reason. It refuses reserved example.com
accounts, refuses to elevate an existing non-administrator, and refuses to
create a second bootstrap administrator when a recoverable active System
Administrator already exists. Re-running it for the same recoverable System
Administrator does not replace the password.

Creation writes the critical `auth.bootstrap_admin.created` event in the same
transaction. Run the non-database preflight tests with:

```powershell
npm run uat:bootstrap-admin
```

## 8. Verification record

| Date | Environment | Result |
| --- | --- | --- |
| 2026-09-09 | Supabase development database | Migration applied; seed rerun returned stable counts; existing `ADMIN` mapped to `SYSTEM_ADMIN`; no users or active roles left without assignments/grants |
