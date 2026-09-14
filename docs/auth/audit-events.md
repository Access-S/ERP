# Authentication and Authorization Audit Events

Status: Classified security-monitoring foundation implemented and verified
Owner: Product owner / Engineering
Last updated: 2026-09-14

## 1. Purpose

This catalogue defines the security events the ERP must record. It supports
incident investigation, accountability, user administration, and future alerting
without turning logs into a store of passwords or unnecessary personal data.

This file covers identity, session, and access-control events. Business-record
history such as BOM activation will eventually have a broader audit catalogue,
but should use compatible actor and correlation fields.

## 2. Principles

- Audit records are append-only through normal application behaviour.
- Successful and failed security-sensitive operations are recorded.
- Events use stable names; display descriptions may change independently.
- A failure event records a sanitized reason code, not secrets or raw input.
- Audit writes must not be client-controlled.
- A failure to write a critical privilege-change event should fail the associated
  privilege change or enter a durable retry path.
- Audit access is itself permission-controlled and audited.
- Timestamps are stored in UTC and displayed in the user's configured timezone.

### 2.1 Current implementation

Migration `20260912010000_add_security_audit_events` adds the
`security_audit_events` table and a PostgreSQL trigger that rejects every
ordinary update or deletion. The application exposes no mutation route for
audit rows.

The server-only writer accepts a closed event-type catalogue, generates the
correlation ID on the server, bounds identifiers, and retains only metadata
keys explicitly allowlisted for that event. Password, secret, token, cookie,
authorization, session, credential, and hash-shaped metadata keys are removed
even if a developer accidentally includes one.

The following are captured now:

- successful and failed password login attempts;
- successful and failed password changes and resets;
- invitation creation, replacement, cancellation, and acceptance;
- user creation and account status changes;
- role assignment/revocation, custom-role changes, and permission changes;
- session invalidation caused by role or account-state changes;
- sensitive server-operation access denials; and
- audit-history views.

Critical account, invitation, role, and successful password events are inserted
in the same database transaction as the security change. Logout/expiry events
require the later session-lifecycle increment.

## 3. Minimum event shape

| Field | Required | Purpose |
| --- | --- | --- |
| `id` | Yes | Unique immutable event ID |
| `eventType` | Yes | Stable dotted event key |
| `occurredAt` | Yes | UTC server timestamp |
| `outcome` | Yes | `SUCCESS`, `FAILURE`, or `DENIED` |
| `actorUserId` | When known | Stable user ID; nullable for unknown login attempts |
| `actorEmailSnapshot` | When justified | Normalized identifier used during auth; retention-limited |
| `targetType` | When applicable | Type such as `USER`, `ROLE`, or `SESSION` |
| `targetId` | When applicable | Stable target ID |
| `reasonCode` | On failure/denial | Sanitized machine-readable reason |
| `correlationId` | Yes | Connects related request, domain, and audit logs |
| `sourceIp` | Production decision | Security investigation signal with retention controls |
| `userAgent` | Production decision | Client context with length and privacy limits |
| `metadata` | Optional | Allowlisted structured details only |

The actor's display name may change, so stable user IDs are primary. A limited
snapshot can help investigations but must not become an uncontrolled copy of
the user record.

## 4. Prohibited audit content

Never store:

- Plaintext passwords or password hashes.
- Session cookies, JWTs, refresh tokens, invitation tokens, or reset tokens.
- MFA secrets or recovery codes.
- Full request bodies from login, invitation, or password forms.
- Database connection strings, API keys, or application secrets.
- Unbounded headers or arbitrary client-controlled metadata.

## 5. Authentication events

| Event key | Outcome | Minimum context |
| --- | --- | --- |
| `auth.login.succeeded` | Success | User ID, correlation ID, session ID hash/reference if supported |
| `auth.login.failed` | Failure | Normalized identifier snapshot, generic reason category, correlation ID |
| `auth.logout.succeeded` | Success | User ID and session reference |
| `auth.session.expired` | Success | User ID and expiry reason when known |
| `auth.session.revoked` | Success | User ID, initiator, reason, affected session count |
| `auth.password.changed` | Success | User ID and whether self-service or administrator initiated |
| `auth.password.change_failed` | Failure | User ID when known and sanitized reason |
| `auth.password_reset.requested` | Success | Identifier snapshot; client response remains generic |
| `auth.password_reset.completed` | Success | User ID; never the token |
| `auth.password_reset.failed` | Failure | Sanitized reason such as expired or already used |
| `auth.invitation.created` | Success | Target user ID, inviter ID, expiry; never the token |
| `auth.invitation.accepted` | Success | Target user ID |
| `auth.invitation.revoked` | Success | Target user ID and administrator ID |
| `auth.bootstrap_admin.created` | Success | Created user ID and execution correlation ID |

Reason categories for login failures should be specific enough for internal
monitoring but must not be returned directly to the user. Examples include
`INVALID_CREDENTIALS`, `ACCOUNT_UNAVAILABLE`, and `RATE_LIMITED`.

## 6. Account administration events

| Event key | Outcome | Minimum context |
| --- | --- | --- |
| `auth.user.created` | Success | Actor and target user IDs |
| `auth.user.updated` | Success | Actor, target, and allowlisted changed field names |
| `auth.user.suspended` | Success | Actor, target, and required reason |
| `auth.user.reactivated` | Success | Actor, target, and reason |
| `auth.user.disabled` | Success | Actor, target, and required reason |
| `auth.user.email_changed` | Success | Actor, target, old/new normalized identifiers with retention controls |
| `auth.role.assigned` | Success | Actor, target user, and role key |
| `auth.role.revoked` | Success | Actor, target user, and role key |
| `auth.role.created` | Success | Actor and role key |
| `auth.role.updated` | Success | Actor, role key, and changed field names |
| `auth.role.permission_added` | Success | Actor, role key, and permission key |
| `auth.role.permission_removed` | Success | Actor, role key, and permission key |

Role changes should also increment the target user's session/auth version and
record the resulting session revocation where applicable.

## 7. Authorization events

| Event key | When to record | Minimum context |
| --- | --- | --- |
| `auth.access.denied` | Sensitive mutation, admin page, export, or repeated read denial | Actor, permission key, resource type, sanitized reason |
| `auth.audit.viewed` | Security audit log viewed | Actor and filter summary |
| `auth.audit.exported` | Security audit data exported | Actor, time range, record count, export ID |
| `auth.permission_registry.changed` | Seeded/custom permission definition changes | Actor or deployment identity and changed keys |

Routine denied navigation should not flood storage. The implementation may
sample low-risk read denials, but must retain denials involving administration,
role management, exports, approvals, or repeated suspicious behaviour.

## 8. Integrity and access

- Application users must not update or delete audit events.
- Direct database access to the audit table is restricted to migration and
  authorized operational identities.
- `admin.audit.view` permits viewing through the application.
- Export requires a separate permission if exports are implemented.
- Audit queries must avoid returning authentication metadata that the viewer
  does not need.
- `/settings/access/audit` requires `admin.audit.view`, leads with 24-hour
  security indicators, separates events into Authentication, User Lifecycle,
  Roles & Permissions, and Security Oversight, and retains a filterable view of
  the 100 newest matching records.
- Audit-view evidence is scheduled with Next.js `after()` once the response is
  complete, avoiding a database mutation during Server Component rendering.
  A failed view-log write is reported to server operations without replacing
  the already-authorized response.
- The broader category and future operational-audit direction is maintained in
  [Audit information architecture](../architecture/audit-information-architecture.md).
- Actor IDs deliberately remain scalar snapshots rather than foreign keys, so
  later identity retention changes cannot rewrite an historical event.
- Retention, archival, and legal hold rules must be decided before production.

## 9. Initial alerts for production

Monitoring should eventually detect:

- Repeated login failures for one account or network source.
- Login to a privileged account after a long inactive period.
- System Administrator role assignment or removal.
- Multiple access denials for administrative or export permissions.
- Account suspension followed by continued session activity.
- Audit-write failures.

## 10. Verification requirements

Tests must prove that:

1. Success and failure events use the expected event type and outcome.
2. The actor and target cannot be supplied or changed by the browser.
3. Passwords, tokens, and hashes never enter event metadata.
4. Role assignment and account suspension invalidate authorization as designed.
5. Users without `admin.audit.view` cannot read audit records.
6. Audit viewers cannot mutate or delete records through application paths.

Run `npm run uat:security-audit` for rollback-safe database integrity and
metadata privacy checks. Run `npm run uat:security-audit-routes` against the
development server for authorized-view, denied-view, and login event capture.
The route suite deliberately retains its generated records because the database
correctly prevents historical audit evidence from being deleted.

## 11. Open decisions

1. Retention period for login failures and source IP addresses.
2. Retention period for role and account administration events.
3. Whether source IP is stored raw, truncated, hashed, or delegated to hosting
   logs.
4. Whether audit events live in the primary database or a separate append-only
   destination before production.
5. Which role may export audit information.
6. Which audit failures must block the associated business operation.

## 12. Change log

| Date | Change |
| --- | --- |
| 2026-09-09 | Created the initial auth, account administration, and authorization event catalogue. |
| 2026-09-12 | Implemented append-only PostgreSQL storage, the allowlisted server writer, security event capture, protected audit viewer, and integrity/privacy UAT. |
| 2026-09-13 | Added allowlisted password change/reset events and correlated session-revocation capture. |
| 2026-09-13 | Added the typed category/severity registry and security-first monitoring layout. |
| 2026-09-14 | Verified the dashboard and protected routes, moved view logging to post-response execution, and added safe handling for unknown stored event keys. |
