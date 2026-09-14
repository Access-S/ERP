# ADR 005: Sensitive Access Change Reasons

Status: Accepted and implemented
Date: 2026-09-14
Owners: Product owner / Engineering

## Context

Access Control already records who changed an account or role and when it
happened. For an investigation, that is incomplete without the administrator's
business reason. A reason also makes the administrator pause and review the
change they are about to make.

## Decision

A plain-language reason is mandatory for:

- changing an existing user's assigned roles;
- suspending, disabling, or reactivating an account;
- editing, archiving, or reactivating a custom role;
- issuing an administrator-controlled password reset link; and
- replacing an activation link.

The server accepts a normalized reason of 10 to 256 characters. Client-side
controls assist the user, but the Server Action schema is the enforcement
boundary. The reason is allowlisted into the append-only audit event written in
the same database transaction as the sensitive change.

Creating a new invited user does not require a separate reason in this
increment because the administrator already supplies the recipient identity and
initial roles. Creating a new custom role also does not require one because its
name and description state its purpose and it grants no access until assigned.

## Safety and privacy

- Reasons must not contain passwords, activation/reset links, tokens, medical
  details, or unnecessary personal information.
- The browser cannot select the actor, target audit identity, or event type.
- A reason explains a decision; it does not replace authorization, approval,
  re-authentication, or future MFA requirements.
- Related granular events share a correlation ID so permission and session
  consequences can be investigated together.

## Consequences

Administrators perform one additional short input step for sensitive changes.
The audit history gains enough context to distinguish routine approved work from
unexpected or potentially abusive access changes without adding a new mutable
business table.
