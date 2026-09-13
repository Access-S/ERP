# ADR 003: Password Management and Recovery

Status: Accepted
Date: 2026-09-13
Decision owners: Product owner / Engineering

## Context

Account activation establishes an initial password, but active users also need
self-service changes and controlled recovery. The project does not yet have a
production email provider, so an email-shaped workflow would either expose
tokens in logs or falsely imply deliverability.

## Decision

1. Require the current password for authenticated self-service changes.
2. Let users choose only their own replacement password.
3. Give administrators no special password access; use `admin.user.manage` only
   to create a bearer reset link for another active account.
4. Use random 256-bit reset secrets, store only SHA-256 hashes, expire links
   after one hour, and allow one successful use.
5. Revoke older unused links when a replacement is created.
6. Increment `authVersion` after every successful change or reset so all prior
   sessions become invalid.
7. Continue bcrypt cost 12 and the accepted 12-character/72-byte boundary.
8. Use administrator-controlled private delivery until production email,
   throttling, and monitoring are selected.

## Consequences

- Administrators can assist recovery without learning user passwords.
- A copied reset link is a temporary credential and requires careful delivery.
- Suspended or disabled accounts must be restored deliberately before recovery.
- Public forgot-password requests remain deferred rather than silently dropping
  or logging working links.
- Password and session changes are visible in the append-only security audit.

## Alternatives considered

Administrator-chosen temporary passwords were rejected because they expose
credentials and require forced-change state. Keeping old sessions after a reset
was rejected because a compromised session would survive credential recovery.
Logging reset links during development was rejected because logs are not a
credential-delivery channel.

## Related documents

- [Password management and recovery](../password-management.md)
- [User onboarding](../user-onboarding.md)
- [Authentication and authorization architecture](../authentication-and-authorization-architecture.md)
- [Audit events](../audit-events.md)
