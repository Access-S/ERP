# Authentication and Authorization Documentation

Status: Active documentation set
Owner: Product owner / Engineering
Last updated: 2026-09-14

## Purpose

This folder is the source of truth for identity, authentication, sessions,
authorization, roles, permissions, and security events in the ERP.

Authentication answers **who is using the system**. Authorization answers
**what that user may do**. Both must be designed and tested together, but they
remain separate responsibilities.

## Document map

| Document | Purpose | Update when |
| --- | --- | --- |
| [Authentication and authorization architecture](authentication-and-authorization-architecture.md) | Current state, target design, trust boundaries, flows, data model, and security rules | The auth design or implementation boundary changes |
| [Roles and permissions](roles-and-permissions.md) | Business roles, permission catalogue, role matrix, ownership, and open business decisions | A role, module, action, approval, or scope changes |
| [Access Control administration](access-control-administration.md) | Current user/role administration pages, safety rules, workflow, and custom-role direction | An account lifecycle, role-assignment, or custom-role workflow changes |
| [User onboarding](user-onboarding.md) | Invitation, activation, password, link-delivery, and verification rules | User creation, activation, password policy, or delivery changes |
| [Password management](password-management.md) | Self-service password changes, administrator reset links, session invalidation, and delivery boundary | Password change, recovery, reset, or password-session behaviour changes |
| [Audit events](audit-events.md) | Events that must be recorded, minimum fields, privacy rules, and retention decisions | A security-sensitive event or audit requirement is introduced |
| [Implementation plan](implementation-plan.md) | Ordered delivery stages, verification gates, and current progress | An auth task starts, completes, changes, or becomes blocked |
| [Products & BOM role UAT](product-bom-role-uat.md) | Manual role-by-role checks for Customers, Products, Parts, and BOM workflows | A module permission, field scope, role grant, or test outcome changes |
| [RBAC migration runbook](rbac-migration-runbook.md) | Safe commands, verification, retry, and recovery guidance for the authorization foundation | The RBAC schema, seed, audit, or deployment process changes |
| [ADR 001: Auth foundation](decisions/001-auth-foundation.md) | Durable record of the initial Auth.js, Prisma, and RBAC decisions | A foundational decision is replaced or amended |
| [ADR 002: User invitations and passwords](decisions/002-user-invitations-and-passwords.md) | Durable record of invitation-token, delivery, and bcrypt decisions | Password hashing or onboarding security changes |
| [ADR 003: Password management and recovery](decisions/003-password-management-and-recovery.md) | Durable record of reset-token, administrator-assistance, and session-revocation decisions | Password change or recovery security changes |
| [ADR 004: Session lifetime and login throttling](decisions/004-session-lifetime-and-login-throttling.md) | Durable record of inactivity/overall expiry, account throttling, recovery, and audit decisions | Session lifetime, login throttling, or network-source controls change |

## Sources of truth

When documents and code disagree, use this order to identify and resolve the
gap:

1. The deployed database schema and migrations describe stored data.
2. Server-side authorization code describes what is currently enforced.
3. Automated authorization tests describe verified behaviour.
4. This folder describes the intended behaviour and outstanding gaps.
5. Client-side navigation and button visibility describe user experience only;
   they are never a security boundary.

Any disagreement between these sources is a defect or an explicitly tracked
migration state. Do not silently change a document to hide an implementation
gap.

## Maintenance rule for every feature

When adding or changing a protected operation:

1. Add or confirm its stable permission key in
   [roles-and-permissions.md](roles-and-permissions.md).
2. Assign it to the intended roles in the matrix.
3. Enforce it at the server-side data or mutation boundary.
4. Use the same decision to hide or disable unavailable UI controls.
5. Add allow and deny tests.
6. Add an audit event when the action changes access, credentials, approval, or
   other sensitive state.
7. Update [implementation-plan.md](implementation-plan.md).

## Documentation conventions

- Permission keys use lowercase `resource.action` names, for example
  `bom.activate`.
- Role keys use stable uppercase names, for example `PRODUCTION_PLANNER`.
- Audit event keys use lowercase dotted past-tense names, for example
  `auth.login.succeeded`.
- Documents must distinguish **current**, **target**, and **future** behaviour.
- Secrets, passwords, hashes, tokens, recovery codes, and real credentials must
  never appear in documentation, screenshots, fixtures, or Git history.
- Architectural reversals require a new ADR; do not rewrite the historical
  reason as though the earlier decision never existed.

## External references

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Auth.js documentation](https://authjs.dev/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
