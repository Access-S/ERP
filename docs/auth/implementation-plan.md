# Authentication and Authorization Implementation Plan

Status: Development security foundation complete; deployment decisions remain
Owner: Product owner / Engineering
Last updated: 2026-09-14

## 1. Objective

Replace the current prototype's single free-text role and authentication-only
mutation checks with a maintainable, server-enforced, tested authorization
system without breaking existing users or master-data workflows.

This is a progress tracker, not a replacement for the architecture or role
matrix. Update it in the same commit as implementation work.

## 2. Current baseline

| Capability | Status | Evidence or gap |
| --- | --- | --- |
| Email/password login | Hardened foundation complete | Normalized/bounded credentials, generic failures, account-bound temporary throttling, and Auth.js Credentials |
| Password hashing | Initial decision complete | bcrypt cost 12; 12-character minimum and 72-byte maximum recorded in ADR 002 |
| JWT session | Lifetime and freshness controls complete | One-hour idle, 12-hour absolute, server-issued start claim, and `authVersion` invalidation |
| Page redirect | Prototype complete | Next.js Proxy redirects unauthenticated requests |
| Mutation authentication | Completed master-data modules protected | Customer, Product, Part, and BOM writes enforce typed permissions |
| Normalized roles and permissions | Foundation complete | 11 system roles, 74 permissions, 190 standard grants, and existing-user mapping are seeded |
| Server-side permission enforcement | Four master-data modules complete | Central typed guard is adopted by Customers, Parts, Products, and BOMs |
| Account administration | User and role lifecycle complete | Invitation, activation, status, assignment, effective access, and custom-role UI exist |
| Session invalidation after access change | Implemented for current administration flows | Status, assignment, and active custom-role permission changes increment `authVersion` |
| Auth security audit log | Classified monitoring foundation complete | Append-only storage, allowlisted writer, category/severity registry, security-first dashboard, and login/access/password administration events |
| Password management | Complete and manually accepted | Self-service changes, one-hour administrator reset links, session invalidation, and audit capture |
| Authorization tests | Core complete | Pure policy and live database UAT cover unauthenticated, stale, inactive, multi-role, allowed, denied, and System Administrator separation paths |

## 3. Delivery sequence

### Phase 0: Confirm implementation choices

- [x] Confirm password hashing choice for new passwords.
- [x] Confirm initial session idle and absolute lifetime.
- [ ] Confirm who may assign roles.
- [ ] Confirm whether version 1 is organization-wide or needs site/warehouse
  scope.
- [ ] Confirm the safest defaults for the open role-matrix decisions.

Exit gate: decisions needed for the first migration are recorded in an ADR or
the appropriate source document.

### Phase 1: Normalize the authorization schema

- [x] Add account status and `authVersion` to `User`.
- [x] Add `Role`, `Permission`, `UserRole`, and `RolePermission` models.
- [x] Add immutable identifiers, uniqueness constraints, and indexes.
- [x] Create a forward migration that preserves all existing users.
- [x] Seed stable role and permission keys idempotently.
- [x] Map every known legacy role string or explicitly report it for review.
- [x] Document retry and recovery procedures for the development database.

Exit gate: migration succeeds on a representative copy, seed re-runs safely,
and every existing user has a deliberate role mapping.

### Phase 2: Centralize server identity and permission checks

- [x] Create a server-only current-principal loader.
- [x] Create typed `requireUser` and `requirePermission` helpers.
- [x] Resolve the union of permissions for multiple roles.
- [x] Deny disabled, suspended, deleted, or stale-version sessions.
- [x] Distinguish unauthenticated and forbidden results safely.
- [x] Add unit/integration tests for the helpers.

Exit gate: the guard tests prove unauthenticated, allowed, denied, multi-role,
and stale-session paths.

### Phase 3: Protect completed master-data modules

Implement one module at a time in this order so the pattern is proven before
wide adoption:

1. Parts.
2. Products.
3. BOM revisions and activation.
4. Customers.

Module status:

| Module | Status | Enforced boundary |
| --- | --- | --- |
| Parts | Complete | List/detail routes, table fetch, create, edit, deactivate, and reactivate |
| Products | Complete | Dashboard/catalog reads, create, field-scoped edit, deactivate, and reactivate |
| BOM revisions | Complete | List/detail reads, draft creation/editing, Parts lookup, and compound activation/archive boundary |
| Customers | Complete | List/detail routes, create, field-scoped identity/contact/financial edits, deactivate, and reactivate |

For each module:

- [x] Protect list/detail reads where required.
- [x] Protect every Server Action independently.
- [x] Apply the stable permission key from the role matrix.
- [x] Add allowed and denied direct-invocation tests.
- [x] Update navigation and buttons using the same effective permission result.
- [x] Verify that hidden controls are not the only protection.

Exit gate: all completed master-data modules enforce the documented matrix on
the server and pass deny-path tests.

### Phase 4: User lifecycle and administration

- [x] Remove prototype credentials from the login screen and bootstrap script.
- [x] Add an environment-safe bootstrap administrator procedure.
- [x] Add user creation/invitation.
- [x] Add activation/password setup.
- [x] Add suspend, reactivate, and disable operations for existing users.
- [x] Add multiple-role assignment and removal for existing users.
- [x] Add create, duplicate, edit, archive, and reactivate workflows for custom roles.
- [x] Keep system roles locked and custom permissions constrained to the catalogue.
- [x] Prevent accidental removal of the last recoverable administrator.
- [x] Require reasons for sensitive access changes where defined.

Exit gate: an authorized administrator can manage accounts without direct
database editing, and an unauthorized user cannot invoke those operations.

### Phase 5: Session and login hardening

- [x] Normalize login identifiers.
- [x] Add server-side credential validation and maximum lengths.
- [x] Configure explicit session lifetimes.
- [x] Add session invalidation after password, status, and role changes.
- [x] Add account-bound rate limiting for authentication attempts.
- [x] Add secure invitation tokens with controlled manual delivery.
- [x] Add password-reset tokens and controlled administrator delivery.
- [ ] Add production email delivery and public recovery requests.
- [ ] Confirm production TLS, cookie, and secret configuration.
- [ ] Decide MFA requirements for privileged users.

Exit gate: shared/staging deployment contains no default credentials and passes
the login/session security scenarios.

### Phase 6: Security audit trail

Development increment status: complete. Production retention, archival, and
alert-delivery policy remains an explicit release gate rather than an unfinished
dashboard feature.

- [x] Add append-only security audit storage.
- [x] Add a server-only event writer with allowlisted metadata.
- [x] Record login, account-state, password, role, and access-denied events.
- [x] Protect audit viewing with `admin.audit.view`.
- [x] Add audit integrity and secret-exclusion tests.
- [ ] Decide retention and alerting before production.

Exit gate: the required events in [audit-events.md](audit-events.md) are either
implemented and tested or explicitly deferred from the release.

### Phase 7: Production readiness review

- [ ] Run the complete allow/deny authorization test suite.
- [ ] Run the existing master-data/BOM UAT suite under representative roles.
- [ ] Review environment variables and remove all test credentials.
- [ ] Confirm backup, recovery, and last-administrator procedures.
- [ ] Review dependency versions and security advisories.
- [ ] Complete a focused security review.
- [ ] Update all auth documents from target to implemented state.

Exit gate: no known critical auth gap is described as complete, and every
accepted deferral has an owner and release boundary.

## 4. Definition of done for an authorization change

An authorization task is complete only when:

1. The permission key exists in the catalogue.
2. The role matrix identifies intended access.
3. The server enforces the permission.
4. The UI reflects the permission without being the sole control.
5. Allowed and denied paths are tested.
6. Audit behaviour is implemented or explicitly marked not required.
7. Relevant documentation and this tracker are updated.

## 5. First implementation goal

The recommended first coding goal is **Phase 1: normalize the authorization
schema and seed stable roles/permissions**. It creates the foundation used by
all later guards and avoids building page-specific role checks that would need
to be replaced.

The migration must be additive first: create the new tables, map existing users,
verify the mapping, then remove the legacy free-text role in a later migration.

## 6. Change log

| Date | Change |
| --- | --- |
| 2026-09-09 | Created the phased implementation and verification plan from the current prototype baseline. |
| 2026-09-09 | Completed Phase 1 schema, migration, seed, legacy ADMIN mapping, authorization registry, compatibility audit, and bootstrap-script hardening. |
| 2026-09-10 | Completed Phase 2 central policy/service, normalized login, authVersion session claim, minimal access query, and core/live-database authorization UAT. |
| 2026-09-10 | Upgraded vulnerable Next.js 16.3.0 to patched 16.3.4 and applied compatible transitive dependency fixes discovered during the auth review. |
| 2026-09-10 | Completed Phase 3 Parts enforcement across reads, mutations, action visibility, and allowed/denied operation UAT. |
| 2026-09-10 | Completed Phase 3 Product enforcement, including field-scoped master/commercial edits and compound Product/BOM lifecycle permissions. |
| 2026-09-10 | Completed Phase 3 BOM enforcement across reads, draft preparation, Parts lookup, and compound activation/archive authorization. |
| 2026-09-10 | Completed Phase 3 Customer enforcement, including separate identity, contact, financial, and lifecycle permission boundaries. |
| 2026-09-10 | Accepted Phase 3 manual role UAT across all isolated Product/BOM roles and the Sales + Finance add/remove multi-role scenario. |
| 2026-09-11 | Added the protected Access Control overview, Users and Roles pages, effective-permission visibility, existing-role assignment, account status controls, authVersion invalidation, and last-active-administrator protection. |
| 2026-09-11 | Hardened Access Control clients against stale development Server Action responses and verified the reversible suspend/reactivate workflow end to end. |
| 2026-09-11 | Added `admin.role.manage`, custom-role create/duplicate/edit/archive/reactivate workflows, assigned-user impact visibility, session invalidation on permission changes, and end-to-end lifecycle verification. |
| 2026-09-12 | Added `admin.user.invite`, administrator-created invited accounts, hashed single-use activation links, recipient password setup, cancellation/reissue recovery, bounded login credentials, and the redesigned EON sign-in experience. |
| 2026-09-12 | Accepted manual UAT for the redesigned login and complete invitation, activation, cancellation, restoration, and assigned-role access lifecycle. |
| 2026-09-12 | Added append-only security-audit storage, a typed allowlisted writer, transactional account/role/invitation events, login and access-denial capture, a protected audit viewer, and rollback-safe integrity/privacy UAT. |
| 2026-09-13 | Added self-service password changes, administrator-delivered one-hour reset links, password-triggered session invalidation, and password audit events. |
| 2026-09-13 | Product owner manually accepted the password change, administrator recovery, single-use reset, credential restoration, session invalidation, and audit scenarios. |
| 2026-09-14 | Completed and automatically verified the classified security-monitoring dashboard, category views, severity prioritisation, investigation filters, and post-response view auditing. |
| 2026-09-14 | Added and verified one-hour idle/12-hour absolute sessions, five-attempt temporary login throttling, recovery clearing, and logout/expiry/throttle audit events. |
| 2026-09-14 | Required server-validated, allowlisted audit reasons for sensitive account, role, password-reset, and activation-link changes. |
| 2026-09-14 | Hardened the first-administrator bootstrap with environment, database-host, email, credential, single-admin, and audit safeguards. |
