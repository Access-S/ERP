# Dependency Security Audit

Status: Active register
Owner: Engineering
Last updated: 2026-09-10

## Purpose

This register records dependency findings that affect the whole ERP. Identity,
role, permission, and session design remains under `docs/auth/`; framework and
third-party package advisories belong here.

## 2026-09-10 review

Commands used:

```powershell
npm audit --omit=dev
npm ls next server-only --depth=0
```

Initial result: 9 production-tree findings, including critical Next.js remote
code execution advisories affecting the installed `next@16.3.0`.

Actions:

1. Upgraded Next.js from `16.3.0` to patched `16.3.4` without changing the
   major/minor release line.
2. Ran non-forced `npm audit fix` to accept compatible transitive fixes.
3. Did not run `npm audit fix --force` because it proposed a breaking ExcelJS
   downgrade.
4. Rebuilt and reran authorization tests after dependency changes.

Reference:

- [Next.js Windows-hosted RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release)

## Remaining accepted finding

`npm audit --omit=dev` reports two moderate findings through `exceljs@4.4.0` and
its `uuid@8.3.2` dependency. The advisory concerns buffer handling in UUID
v3/v5/v6. In this project ExcelJS is currently used only by the local BOM
workbook validation/import tooling; it is not used by a public upload endpoint
or the authentication runtime.

Current treatment:

- Do not downgrade automatically to the breaking version proposed by
  `npm audit fix --force`.
- Accept temporarily for local controlled workbook processing.
- Re-evaluate ExcelJS, an upstream dependency fix, an override proven by tests,
  or a replacement parser before accepting untrusted workbook uploads.
- Keep workbook validation and import commands restricted to authorized
  operators.

## Maintenance rule

Update this register when a production audit changes severity, a direct or
transitive dependency is upgraded for security, a finding is accepted, or an
accepted finding's exposure changes.
