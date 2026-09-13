export const SECURITY_AUDIT_EVENT_TYPES = [
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.session.revoked",
  "auth.invitation.created",
  "auth.invitation.accepted",
  "auth.invitation.revoked",
  "auth.user.created",
  "auth.user.suspended",
  "auth.user.reactivated",
  "auth.user.disabled",
  "auth.role.assigned",
  "auth.role.revoked",
  "auth.role.created",
  "auth.role.updated",
  "auth.role.permission_added",
  "auth.role.permission_removed",
  "auth.access.denied",
  "auth.audit.viewed",
] as const

export type SecurityAuditEventType =
  (typeof SECURITY_AUDIT_EVENT_TYPES)[number]

export type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]

const ALLOWED_METADATA_KEYS: Record<SecurityAuditEventType, readonly string[]> = {
  "auth.login.succeeded": ["authenticationMethod"],
  "auth.login.failed": [],
  "auth.session.revoked": ["cause", "previousAuthVersion", "nextAuthVersion"],
  "auth.invitation.created": ["operation", "expiresAt"],
  "auth.invitation.accepted": [],
  "auth.invitation.revoked": ["operation"],
  "auth.user.created": ["status"],
  "auth.user.suspended": ["previousStatus", "nextStatus"],
  "auth.user.reactivated": ["previousStatus", "nextStatus"],
  "auth.user.disabled": ["previousStatus", "nextStatus"],
  "auth.role.assigned": ["roleKey"],
  "auth.role.revoked": ["roleKey"],
  "auth.role.created": ["roleKey"],
  "auth.role.updated": ["roleKey", "changedFields", "isActive"],
  "auth.role.permission_added": ["roleKey", "permissionKey"],
  "auth.role.permission_removed": ["roleKey", "permissionKey"],
  "auth.access.denied": ["permissionKey", "resourceType"],
  "auth.audit.viewed": ["eventTypeFilter", "outcomeFilter", "resultCount"],
}

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|cookie|authorization|session|credential|hash)/i
const MAX_STRING_LENGTH = 256
const MAX_ARRAY_ITEMS = 50

function sanitizeValue(value: unknown): AuditMetadataValue | undefined {
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH)
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => item.slice(0, MAX_STRING_LENGTH))
  }
  return undefined
}

export function sanitizeAuditMetadata(
  eventType: SecurityAuditEventType,
  metadata: Readonly<Record<string, unknown>> | undefined
): Record<string, AuditMetadataValue> {
  if (!metadata) return {}

  const allowedKeys = new Set(ALLOWED_METADATA_KEYS[eventType])
  const sanitized: Record<string, AuditMetadataValue> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue
    const sanitizedValue = sanitizeValue(value)
    if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue
  }

  return sanitized
}
