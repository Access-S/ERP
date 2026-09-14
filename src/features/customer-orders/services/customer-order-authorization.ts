import type { PermissionKey } from "../../auth/config/authorization-registry.ts"
import {
  assertPermission,
  hasPermission,
  type AuthorizationPrincipal,
} from "../../auth/services/authorization-policy.ts"

export type CustomerOrderOperation =
  | "view"
  | "create"
  | "edit"
  | "cancel"
  | "amendBlanket"
  | "createRelease"
  | "editRelease"

export const CUSTOMER_ORDER_OPERATION_PERMISSIONS = {
  view: ["customer_order.view"],
  create: ["customer_order.view", "customer_order.create"],
  edit: ["customer_order.view", "customer_order.edit"],
  cancel: ["customer_order.view", "customer_order.cancel"],
  amendBlanket: ["customer_order.view", "customer_order.blanket_amend"],
  createRelease: ["customer_order.view", "customer_order.release.create"],
  editRelease: ["customer_order.view", "customer_order.release.edit"],
} as const satisfies Record<CustomerOrderOperation, readonly PermissionKey[]>

export function hasCustomerOrderPermission(
  principal: AuthorizationPrincipal,
  operation: CustomerOrderOperation
): boolean {
  return CUSTOMER_ORDER_OPERATION_PERMISSIONS[operation].every((permission) =>
    hasPermission(principal, permission)
  )
}

export function assertCustomerOrderPermission(
  principal: AuthorizationPrincipal,
  operation: CustomerOrderOperation
): void {
  for (const permission of CUSTOMER_ORDER_OPERATION_PERMISSIONS[operation]) {
    assertPermission(principal, permission)
  }
}

export async function runAuthorizedCustomerOrderOperation<T>(
  principal: AuthorizationPrincipal,
  operation: CustomerOrderOperation,
  work: () => Promise<T> | T
): Promise<T> {
  assertCustomerOrderPermission(principal, operation)
  return work()
}

