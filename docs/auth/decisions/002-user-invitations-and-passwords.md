# ADR 002: User Invitations and Password Hashing

Status: Accepted
Date: 2026-09-12
Decision owners: Product owner / Engineering

## Context

Access Control can manage existing accounts and custom roles, but direct
database editing is still required to add a person. Administrators do not have
real employee credentials during development and must never choose or retain
another person's production password.

The application already verifies bcrypt hashes through Auth.js and PostgreSQL
already contains the `INVITED` account status.

## Decision

1. Keep administrator-provisioned accounts and no public registration.
2. Create accounts in `INVITED` state with no password.
3. Assign at least one active role during creation.
4. Use random 256-bit, 48-hour, single-use activation tokens.
5. Store only SHA-256 token hashes and revoke older links on reissue.
6. Let recipients create their own password through the bearer activation link.
7. Continue bcrypt with cost factor 12, a 12-character minimum, and a 72-byte
   maximum for this release.
8. Deliver links manually through a controlled channel until a real email
   service is selected.

## Consequences

- Administrators never know user passwords.
- `User.password` becomes nullable only while an account is not activated.
- Anyone possessing an unused link can activate the account, so links must be
  delivered privately and expire quickly.
- Email-provider selection remains independent of the account lifecycle.
- Password reset, login throttling, and MFA remain separate hardening work.

## Alternatives considered

Administrator-created temporary passwords were rejected because they encourage
credential sharing and require another forced-change mechanism. Storing raw
tokens was rejected because a database read would expose working credentials.
Immediate email integration was deferred because no production mail provider or
domain policy has been selected.

## Related documents

- [User onboarding](../user-onboarding.md)
- [Authentication and authorization architecture](../authentication-and-authorization-architecture.md)
- [Implementation plan](../implementation-plan.md)
