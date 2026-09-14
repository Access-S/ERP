# ADR 004: Session Lifetime and Login Throttling

Status: Accepted
Date: 2026-09-14
Decision owners: Product owner / Engineering

## Context

Auth.js previously used its default 30-day sliding JWT lifetime and the login
flow had no persistent failed-attempt control. A manufacturing ERP may be used
from shared or unattended workstations, while an aggressive permanent lock can
also let an attacker deny access to a legitimate employee.

Auth.js `session.maxAge` refreshes a JWT as the session remains active. An
explicit claim is therefore required to enforce an overall lifetime that cannot
slide indefinitely.

## Decision

1. Keep encrypted Auth.js JWT sessions for the current release.
2. Set the sliding inactivity lifetime to one hour.
3. Add a server-issued `sessionStartedAt` JWT claim and require a full sign-in
   after an overall lifetime of 12 hours.
4. For pre-existing tokens without the new claim, use the signed JWT issue time
   as the migration baseline.
5. Associate password-failure counters with the known account, not source IP.
6. Activate a 15-minute temporary login throttle after five failed passwords
   inside a 15-minute observation window.
7. Keep the user account `ACTIVE`; the throttle is temporary authentication
   state and never becomes an account suspension or permanent lock.
8. Return the existing generic sign-in failure before and during throttling.
9. Clear throttle state after a successful login, self-service password change,
   or completed administrator-assisted password reset.
10. Record the throttle activation once as `auth.login.rate_limited`. Do not
    write one database event for every request received during the blocked
    window, because the audit sink must not become an amplification target.
11. Record explicit logout and observable absolute-session expiry. With the
    current stateless design, an already-expired idle JWT cannot reliably expose
    a verified user identity for a new audit row.
12. Add hosting-level and trusted-network-source throttling before a public
    production deployment. Source IP storage remains deferred until proxy trust,
    privacy, and retention rules are accepted.

## Consequences

- Stolen sessions cannot remain active indefinitely through continued use.
- An unattended workstation requires reauthentication after one hour without
  activity, and every shift-length session requires a fresh login after 12 hours.
- Distributed password guessing against one known account is slowed even when
  the attacker changes network source.
- A malicious party can temporarily inconvenience a known account, but cannot
  permanently disable it or change its business status.
- Database-backed counters work consistently across multiple application
  instances.
- Public deployment still requires a complementary host/network limiter and an
  MFA decision for privileged roles.

## Alternatives considered

The Auth.js default 30-day sliding lifetime was rejected as too permissive for
shared operational terminals. A permanent administrator-unlock requirement was
rejected because it enables denial of service and increases recovery workload.
An IP-only limiter was rejected because distributed attacks change source and
proxy headers are unsafe until the hosting trust boundary is configured.
In-memory throttling was rejected because counters would differ across server
instances and disappear after a restart.

## Related documents

- [Authentication and authorization architecture](../authentication-and-authorization-architecture.md)
- [Audit events](../audit-events.md)
- [Password management and recovery](../password-management.md)
- [Implementation plan](../implementation-plan.md)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
