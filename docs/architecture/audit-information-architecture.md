# Audit Information Architecture

Status: Security categories implemented; operational categories are planned
Owner: Product owner / Engineering
Last updated: 2026-09-14

## Purpose

The ERP must retain a complete history without forcing every role to review one
undifferentiated event stream. Storage remains canonical and append-only, while
the application presents purpose-built views based on event category, severity,
module, target record, and viewing permission.

## Storage and presentation decision

Version 1 uses one append-only audit-event store. Events keep a stable event
type, outcome, actor, target, correlation ID, timestamp, and allowlisted context.
The typed event registry maps each event type to its category, default severity,
human-readable label, and explanation.

Separate UI tables are views over this canonical history; they are not separate
source-of-truth tables. This preserves cross-module investigations, shared
integrity controls, and consistent retention. Time or category partitioning may
be added later if volume requires it without changing the user-facing model.

## Category model

| Category | Primary audience | Examples | Default placement |
| --- | --- | --- | --- |
| Authentication & Sessions | System Administrator, security reviewer | Login failure, password reset, session revocation, future lockout | Security monitoring |
| User Lifecycle | System Administrator, authorised account administrator | Invitation, activation, suspension, disabling | Security monitoring |
| Roles & Permissions | System Administrator, access reviewer | Role grant/removal, custom-role changes, privileged permission changes | Security monitoring |
| Security Oversight | System Administrator, security reviewer | Denied access, audit views, future exports and alerts | Security monitoring |
| System Configuration | System Administrator, operations owner | Company policy, integration, import, and configuration changes | Planned system audit |
| Master Data | Operations, planning, quality, authorised auditors | Customer, Product, Part, and BOM lifecycle | Planned operational audit and record Activity tabs |
| Procurement & Approvals | Procurement, Finance, approvers, authorised auditors | PO creation, submission, approval, rejection, cancellation | Planned procurement audit and PO Activity tabs |
| Production & Quality | Production, Quality, authorised auditors | Work execution, inspection, release, hold, and non-conformance | Planned production/quality audit |

## Security-first landing page

`/settings/access/audit` is the security-monitoring surface rather than the
future all-business audit destination. Its default order is:

1. Last-24-hour security indicators.
2. A warning when failed sign-ins or protected-operation denials require review.
3. Authentication and session activity.
4. Role and permission changes.
5. User lifecycle activity.
6. Security oversight activity.
7. A complete filterable security-event investigation table.

The page shows human descriptions first and retains the stable technical event
key, outcome, reason, correlation prefix, actor, and target for investigation.

## Severity

- `INFORMATIONAL`: expected activity such as successful sign-in or activation.
- `NOTICE`: a deliberate security administration change worth reviewing.
- `WARNING`: rejected, recovery, restriction, or session-revocation activity.
- `CRITICAL`: highly privileged changes, including System Administrator grants
  or removals and future audit-integrity failures.

Severity begins with the registry default and may be elevated by outcome or
allowlisted event context. It is a prioritisation aid, not proof of an incident.
Repeated low-level events may later generate a separate higher-severity alert.
An event key that is present in storage but unknown to the running application
is shown as an unclassified warning under Security Oversight instead of breaking
the investigation view.

## Permission direction

`admin.audit.view` currently protects all implemented security categories.
Broader business auditing must introduce category-scoped permissions rather than
granting System Administrators automatic access to every commercial, production,
quality, or financial detail. Candidate permissions include:

- `audit.security.view`
- `audit.master_data.view`
- `audit.procurement.view`
- `audit.production.view`
- `audit.finance.view`
- `audit.export`

Record-level Activity tabs should reuse the same permission decision and filter
the canonical history by target type and target ID.

## Future implementation order

1. Add trusted-network/hosting alert inputs after proxy and source-IP policy is accepted.
2. Add the generic business-audit writer contract and category-scoped permissions.
3. Adopt Product, Part, BOM, and Customer lifecycle events.
4. Add record-specific Activity tabs.
5. Add PO and approval events when Procurement workflows are implemented.
6. Decide retention, export, archival, alert acknowledgement, and time partitioning
   before production.

## Change log

| Date | Change |
| --- | --- |
| 2026-09-13 | Defined canonical storage with classified UI views and implemented the security-first category model. |
| 2026-09-14 | Verified the monitoring dashboard, added post-response view auditing, and made the investigation view resilient to unknown stored event keys. |
| 2026-09-14 | Added account-throttle activation, explicit logout, and observable absolute-session expiry classifications. |
