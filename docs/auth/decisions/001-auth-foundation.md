# ADR 001: Authentication and Authorization Foundation

Status: Accepted
Date: 2026-09-09
Decision owners: Product owner / Engineering

## Context

The ERP currently uses Auth.js Credentials, Prisma, PostgreSQL, bcrypt password
verification, JWT sessions, and a single free-text role on each user. Next.js
Proxy prevents obvious unauthenticated page access, and completed master-data
mutations check for a session. The application now needs durable role-based
authorization before more modules are built.

The project uses Supabase to host PostgreSQL, but does not currently use
Supabase Auth. Database hosting and identity-provider choice are separate
decisions.

## Decision

For the first authorization implementation:

1. Continue using Auth.js as the application's authentication and session
   integration.
2. Continue storing application users in PostgreSQL through Prisma.
3. Use administrator-provisioned internal accounts; do not add public
   self-registration.
4. Replace the single free-text role with normalized `Role`, `Permission`,
   `UserRole`, and `RolePermission` records.
5. Allow multiple roles per user and calculate the union of granted permissions.
6. Use stable permission keys in server code rather than job-title comparisons.
7. Deny by default and enforce authorization close to protected data and every
   mutation.
8. Treat Proxy and client-side UI as convenience layers, not final security
   boundaries.
9. Keep JWT sessions initially, but validate current account state and an auth
   version on protected operations so access changes can invalidate stale
   sessions.
10. Record security-sensitive identity and access events in an append-only audit
    model.

## Reasons

- It evolves the working prototype instead of replacing authentication and
  authorization simultaneously.
- Normalized RBAC supports the agreed production-company roles and employees who
  perform more than one function.
- Stable permissions let business role bundles evolve without rewriting each
  protected operation.
- Server-side checks protect direct Server Action and Route Handler calls even
  when a button is hidden.
- Keeping permissions out of a long-lived JWT reduces stale authorization after
  role changes.
- Separating Supabase Database from Supabase Auth avoids an accidental provider
  migration without defined benefits or requirements.

## Consequences

Positive consequences:

- One maintainable permission vocabulary across modules.
- Safer separation of preparation, approval, and administration.
- Multiple roles can support smaller companies without creating hybrid job
  titles.
- Authorization can later add site or warehouse scope without replacing the
  role model.
- Access decisions become independently testable and auditable.

Costs and trade-offs:

- Protected operations require a database-backed principal/permission lookup.
- JWT freshness and revocation need an explicit implementation.
- Existing user role strings require a careful additive migration.
- Role and permission seeds become controlled application data that must be
  versioned and tested.
- Account administration and security-audit interfaces must be built.

## Alternatives considered

### Hard-code job titles in pages and actions

Rejected because role names would spread through the application, employees
could not safely hold multiple roles, and every role-policy change would require
code changes across modules.

### Put every permission in the JWT until it expires

Rejected as the primary source because permission changes could remain stale and
tokens could become large. A minimal session identity plus server-side effective
permission resolution is safer for the current scale.

### Rely on Proxy and hidden navigation

Rejected because Server Actions, Route Handlers, nested routes, and data access
can be reached independently of visible navigation.

### Migrate immediately to Supabase Auth

Deferred. It may become appropriate if managed password recovery, MFA, SSO, or
other identity-provider requirements outweigh migration cost. Such a change
requires its own ADR and migration plan.

### Build a completely custom session system

Rejected because a maintained authentication library reduces custom security
surface and the current Auth.js integration is already working.

## Review triggers

Revisit this decision if:

- Enterprise SSO or external identity federation becomes a requirement.
- Immediate revocation cannot be achieved reliably with JWT sessions.
- Supabase Auth features materially simplify confirmed production requirements.
- Multiple legal entities require strict tenant isolation.
- Service accounts or public customer/supplier portals are introduced.

## Related documents

- [Authentication and authorization architecture](../authentication-and-authorization-architecture.md)
- [Roles and permissions](../roles-and-permissions.md)
- [Audit events](../audit-events.md)
- [Implementation plan](../implementation-plan.md)
