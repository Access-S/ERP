import type { AuditOutcome } from "@prisma/client"
import type { SecurityAuditEventType } from "./audit-policy"

export const SECURITY_AUDIT_CATEGORIES = [
  "AUTHENTICATION",
  "USER_LIFECYCLE",
  "ROLES_PERMISSIONS",
  "SECURITY_OVERSIGHT",
] as const

export type SecurityAuditCategory = (typeof SECURITY_AUDIT_CATEGORIES)[number]

export const SECURITY_AUDIT_SEVERITIES = [
  "INFORMATIONAL",
  "NOTICE",
  "WARNING",
  "CRITICAL",
] as const

export type SecurityAuditSeverity = (typeof SECURITY_AUDIT_SEVERITIES)[number]

const SECURITY_AUDIT_SEVERITY_PRIORITY: Record<SecurityAuditSeverity, number> = {
  INFORMATIONAL: 0,
  NOTICE: 1,
  WARNING: 2,
  CRITICAL: 3,
}

export const SECURITY_AUDIT_CATEGORY_DEFINITIONS: Record<
  SecurityAuditCategory,
  { label: string; description: string }
> = {
  AUTHENTICATION: {
    label: "Authentication & sessions",
    description: "Sign-ins, password activity, recovery attempts, and session invalidation.",
  },
  USER_LIFECYCLE: {
    label: "User lifecycle",
    description: "Account creation, invitations, activation, suspension, and disabling.",
  },
  ROLES_PERMISSIONS: {
    label: "Roles & permissions",
    description: "Role assignments, custom-role changes, and privileged permission changes.",
  },
  SECURITY_OVERSIGHT: {
    label: "Security oversight",
    description: "Denied sensitive operations and access to the audit history itself.",
  },
}

export type SecurityAuditEventDefinition = {
  category: SecurityAuditCategory
  severity: SecurityAuditSeverity
  label: string
  description: string
}

const UNCLASSIFIED_SECURITY_AUDIT_EVENT: SecurityAuditEventDefinition = {
  category: "SECURITY_OVERSIGHT",
  severity: "WARNING",
  label: "Unclassified security event",
  description: "A stored event is not yet present in this application's security registry.",
}

export const SECURITY_AUDIT_EVENT_REGISTRY = {
  "auth.login.succeeded": {
    category: "AUTHENTICATION",
    severity: "INFORMATIONAL",
    label: "Sign-in succeeded",
    description: "A user successfully authenticated with an accepted method.",
  },
  "auth.login.failed": {
    category: "AUTHENTICATION",
    severity: "WARNING",
    label: "Sign-in failed",
    description: "A sign-in attempt was rejected or the account was unavailable.",
  },
  "auth.password.changed": {
    category: "AUTHENTICATION",
    severity: "NOTICE",
    label: "Password changed",
    description: "A user changed their password through authenticated self-service.",
  },
  "auth.password.change_failed": {
    category: "AUTHENTICATION",
    severity: "WARNING",
    label: "Password change failed",
    description: "A self-service password change was rejected.",
  },
  "auth.password_reset.requested": {
    category: "AUTHENTICATION",
    severity: "NOTICE",
    label: "Password reset issued",
    description: "An administrator issued a short-lived password reset link.",
  },
  "auth.password_reset.completed": {
    category: "AUTHENTICATION",
    severity: "WARNING",
    label: "Password reset completed",
    description: "A password was replaced using a valid recovery link.",
  },
  "auth.password_reset.failed": {
    category: "AUTHENTICATION",
    severity: "WARNING",
    label: "Password reset failed",
    description: "A password recovery attempt was rejected.",
  },
  "auth.session.revoked": {
    category: "AUTHENTICATION",
    severity: "WARNING",
    label: "Sessions invalidated",
    description: "Existing sessions became invalid after a security-sensitive change.",
  },
  "auth.invitation.created": {
    category: "USER_LIFECYCLE",
    severity: "INFORMATIONAL",
    label: "Invitation created",
    description: "An activation link was issued for an invited account.",
  },
  "auth.invitation.accepted": {
    category: "USER_LIFECYCLE",
    severity: "INFORMATIONAL",
    label: "Invitation accepted",
    description: "An invited account completed activation.",
  },
  "auth.invitation.revoked": {
    category: "USER_LIFECYCLE",
    severity: "NOTICE",
    label: "Invitation revoked",
    description: "An unused activation link was cancelled or replaced.",
  },
  "auth.user.created": {
    category: "USER_LIFECYCLE",
    severity: "INFORMATIONAL",
    label: "User created",
    description: "A new ERP user record was created.",
  },
  "auth.user.suspended": {
    category: "USER_LIFECYCLE",
    severity: "WARNING",
    label: "User suspended",
    description: "An account was temporarily blocked from signing in.",
  },
  "auth.user.reactivated": {
    category: "USER_LIFECYCLE",
    severity: "NOTICE",
    label: "User reactivated",
    description: "A restricted account was restored to active use.",
  },
  "auth.user.disabled": {
    category: "USER_LIFECYCLE",
    severity: "WARNING",
    label: "User disabled",
    description: "An account was disabled while its history was retained.",
  },
  "auth.role.assigned": {
    category: "ROLES_PERMISSIONS",
    severity: "NOTICE",
    label: "Role assigned",
    description: "A role was granted to a user.",
  },
  "auth.role.revoked": {
    category: "ROLES_PERMISSIONS",
    severity: "WARNING",
    label: "Role removed",
    description: "A role was removed from a user.",
  },
  "auth.role.created": {
    category: "ROLES_PERMISSIONS",
    severity: "NOTICE",
    label: "Custom role created",
    description: "A new custom access role was created.",
  },
  "auth.role.updated": {
    category: "ROLES_PERMISSIONS",
    severity: "NOTICE",
    label: "Custom role updated",
    description: "A custom role's definition or status changed.",
  },
  "auth.role.permission_added": {
    category: "ROLES_PERMISSIONS",
    severity: "WARNING",
    label: "Role permission added",
    description: "A permission was added to a custom role.",
  },
  "auth.role.permission_removed": {
    category: "ROLES_PERMISSIONS",
    severity: "WARNING",
    label: "Role permission removed",
    description: "A permission was removed from a custom role.",
  },
  "auth.access.denied": {
    category: "SECURITY_OVERSIGHT",
    severity: "WARNING",
    label: "Sensitive access denied",
    description: "A protected server operation rejected the current user.",
  },
  "auth.audit.viewed": {
    category: "SECURITY_OVERSIGHT",
    severity: "INFORMATIONAL",
    label: "Audit history viewed",
    description: "An authorised user opened or filtered security audit history.",
  },
} as const satisfies Record<SecurityAuditEventType, SecurityAuditEventDefinition>

export function getAuditEventTypesForCategory(category: SecurityAuditCategory) {
  return (Object.entries(SECURITY_AUDIT_EVENT_REGISTRY) as [
    SecurityAuditEventType,
    SecurityAuditEventDefinition,
  ][])
    .filter(([, definition]) => definition.category === category)
    .map(([eventType]) => eventType)
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" ? value : null
}

export function classifySecurityAuditEvent(event: {
  eventType: string
  outcome: AuditOutcome
  metadata: unknown
}) {
  const definition =
    SECURITY_AUDIT_EVENT_REGISTRY[event.eventType as SecurityAuditEventType] ??
    UNCLASSIFIED_SECURITY_AUDIT_EVENT
  let severity: SecurityAuditSeverity = definition.severity

  if (event.outcome === "FAILURE" || event.outcome === "DENIED") {
    severity = "WARNING"
  }

  const roleKey = metadataString(event.metadata, "roleKey")
  const permissionKey = metadataString(event.metadata, "permissionKey")
  if (
    roleKey === "SYSTEM_ADMIN" ||
    (permissionKey?.startsWith("admin.") && event.eventType.includes("permission"))
  ) {
    severity = "CRITICAL"
  }

  return { ...definition, severity }
}

export function getSecurityAuditSeverityPriority(severity: SecurityAuditSeverity) {
  return SECURITY_AUDIT_SEVERITY_PRIORITY[severity]
}

export const ATTENTION_SECURITY_AUDIT_EVENT_TYPES = (
  Object.entries(SECURITY_AUDIT_EVENT_REGISTRY) as [
    SecurityAuditEventType,
    SecurityAuditEventDefinition,
  ][]
)
  .filter(([, definition]) => definition.severity !== "INFORMATIONAL")
  .map(([eventType]) => eventType)
