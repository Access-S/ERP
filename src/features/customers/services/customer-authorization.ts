import type { PermissionKey } from "../../auth/config/authorization-registry.ts"
import {
  assertPermission,
  hasPermission,
  type AuthorizationPrincipal,
} from "../../auth/services/authorization-policy.ts"

export type CustomerOperation =
  | "view"
  | "create"
  | "editIdentity"
  | "editContacts"
  | "editFinancial"
  | "deactivate"
  | "reactivate"

export const CUSTOMER_OPERATION_PERMISSIONS = {
  view: ["customer.view"],
  create: ["customer.view", "customer.create"],
  editIdentity: ["customer.edit_identity"],
  editContacts: ["customer.edit_contacts"],
  editFinancial: ["customer.edit_financial"],
  deactivate: ["customer.deactivate"],
  reactivate: ["customer.reactivate"],
} as const satisfies Record<CustomerOperation, readonly PermissionKey[]>

export function getCustomerStatusOperation(
  nextIsActive: boolean
): CustomerOperation {
  return nextIsActive ? "reactivate" : "deactivate"
}

export function hasCustomerPermission(
  principal: AuthorizationPrincipal,
  operation: CustomerOperation
): boolean {
  return CUSTOMER_OPERATION_PERMISSIONS[operation].every((permission) =>
    hasPermission(principal, permission)
  )
}

export function assertCustomerPermission(
  principal: AuthorizationPrincipal,
  operation: CustomerOperation
): void {
  for (const permission of CUSTOMER_OPERATION_PERMISSIONS[operation]) {
    assertPermission(principal, permission)
  }
}

export async function runAuthorizedCustomerOperation<T>(
  principal: AuthorizationPrincipal,
  operation: CustomerOperation,
  work: () => Promise<T> | T
): Promise<T> {
  assertCustomerPermission(principal, operation)
  return work()
}

export type CustomerCreateScope = {
  readonly contacts?: unknown
  readonly financial?: unknown
}

export function assertCustomerCreatePermissions(
  principal: AuthorizationPrincipal,
  scope: CustomerCreateScope
): void {
  assertCustomerPermission(principal, "create")
  if (scope.contacts) assertCustomerPermission(principal, "editContacts")
  if (scope.financial) assertCustomerPermission(principal, "editFinancial")
}

export async function runAuthorizedCustomerCreate<T>(
  principal: AuthorizationPrincipal,
  scope: CustomerCreateScope,
  work: () => Promise<T> | T
): Promise<T> {
  assertCustomerCreatePermissions(principal, scope)
  return work()
}

export type CustomerUpdateScope = {
  readonly identity?: unknown
  readonly contacts?: unknown
  readonly financial?: unknown
}

export function assertCustomerUpdatePermissions(
  principal: AuthorizationPrincipal,
  input: CustomerUpdateScope
): void {
  assertCustomerPermission(principal, "view")
  if (input.identity) assertCustomerPermission(principal, "editIdentity")
  if (input.contacts) assertCustomerPermission(principal, "editContacts")
  if (input.financial) assertCustomerPermission(principal, "editFinancial")
}

export async function runAuthorizedCustomerUpdate<T>(
  principal: AuthorizationPrincipal,
  input: CustomerUpdateScope,
  work: () => Promise<T> | T
): Promise<T> {
  assertCustomerUpdatePermissions(principal, input)
  return work()
}
