export const CUSTOMER_ORDER_AUDIT_EVENT_TYPES = [
  "customer_order.created",
  "customer_order.legacy_imported",
  "customer_order.activated",
  "customer_order.closed",
  "customer_order.cancelled",
  "customer_order.blanket.amended",
  "customer_order.release.created",
  "customer_order.release.cancelled",
  "customer_order.release.revised",
  "customer_order.release.validation_failed",
  "customer_order.release.validation_passed",
  "customer_order.release.value_committed",
  "customer_order.release.value_released",
  "customer_order.release.ready_for_planning",
] as const

export type CustomerOrderAuditEventType =
  (typeof CUSTOMER_ORDER_AUDIT_EVENT_TYPES)[number]

export type BusinessAuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]

const ALLOWED_METADATA_KEYS: Record<CustomerOrderAuditEventType, readonly string[]> = {
  "customer_order.created": ["orderType", "internalOrderNumber"],
  "customer_order.legacy_imported": [
    "legacyPurchaseOrderId",
    "legacyStatus",
    "internalOrderNumber",
  ],
  "customer_order.activated": ["previousStatus", "nextStatus"],
  "customer_order.closed": ["previousStatus", "nextStatus", "reason"],
  "customer_order.cancelled": ["previousStatus", "nextStatus", "reason"],
  "customer_order.blanket.amended": [
    "valueDelta",
    "previousAuthorizedValue",
    "resultingAuthorizedValue",
  ],
  "customer_order.release.created": ["internalReleaseNumber", "orderType"],
  "customer_order.release.cancelled": ["previousStatus", "nextStatus", "reason"],
  "customer_order.release.revised": ["revision", "changedFields", "reason"],
  "customer_order.release.validation_failed": ["revision", "issueCodes"],
  "customer_order.release.validation_passed": ["revision", "expectedNetTotal"],
  "customer_order.release.value_committed": ["committedValue", "availableValue"],
  "customer_order.release.value_released": ["releasedValue", "availableValue"],
  "customer_order.release.ready_for_planning": ["revision", "expectedNetTotal"],
}

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|cookie|authorization|session|credential|hash|email|phone|document)/i
const MAX_STRING_LENGTH = 256
const MAX_ARRAY_ITEMS = 50

function sanitizeValue(value: unknown): BusinessAuditMetadataValue | undefined {
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

export function sanitizeCustomerOrderAuditMetadata(
  eventType: CustomerOrderAuditEventType,
  metadata: Readonly<Record<string, unknown>> | undefined
): Record<string, BusinessAuditMetadataValue> {
  if (!metadata) return {}

  const allowedKeys = new Set(ALLOWED_METADATA_KEYS[eventType])
  const sanitized: Record<string, BusinessAuditMetadataValue> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue
    const sanitizedValue = sanitizeValue(value)
    if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue
  }

  return sanitized
}
