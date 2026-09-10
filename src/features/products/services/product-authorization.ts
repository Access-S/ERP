import type { PermissionKey } from "../../auth/config/authorization-registry.ts"
import {
  assertPermission,
  hasPermission,
  type AuthorizationPrincipal,
} from "../../auth/services/authorization-policy.ts"

export type ProductOperation =
  | "view"
  | "create"
  | "editMaster"
  | "editCommercial"
  | "deactivate"
  | "reactivate"

export const PRODUCT_OPERATION_PERMISSIONS = {
  view: ["product.view", "bom.view"],
  create: [
    "product.view",
    "bom.view",
    "customer.view",
    "product.create",
    "bom.draft.create",
  ],
  editMaster: ["product.edit_master", "customer.view"],
  editCommercial: ["product.edit_commercial"],
  deactivate: ["product.deactivate", "bom.archive"],
  reactivate: ["product.reactivate"],
} as const satisfies Record<ProductOperation, readonly PermissionKey[]>

export function getProductStatusOperation(nextIsActive: boolean): ProductOperation {
  return nextIsActive ? "reactivate" : "deactivate"
}

export function hasProductPermission(
  principal: AuthorizationPrincipal,
  operation: ProductOperation
): boolean {
  return PRODUCT_OPERATION_PERMISSIONS[operation].every((permission) =>
    hasPermission(principal, permission)
  )
}

export function assertProductPermission(
  principal: AuthorizationPrincipal,
  operation: ProductOperation
): void {
  for (const permission of PRODUCT_OPERATION_PERMISSIONS[operation]) {
    assertPermission(principal, permission)
  }
}

export async function runAuthorizedProductOperation<T>(
  principal: AuthorizationPrincipal,
  operation: ProductOperation,
  work: () => Promise<T> | T
): Promise<T> {
  assertProductPermission(principal, operation)
  return work()
}

export type ProductUpdateScope = {
  readonly master?: unknown
  readonly commercial?: unknown
}

export function assertProductUpdatePermissions(
  principal: AuthorizationPrincipal,
  input: ProductUpdateScope
): void {
  assertProductPermission(principal, "view")
  if (input.master) assertProductPermission(principal, "editMaster")
  if (input.commercial) assertProductPermission(principal, "editCommercial")
}

export async function runAuthorizedProductUpdate<T>(
  principal: AuthorizationPrincipal,
  input: ProductUpdateScope,
  work: () => Promise<T> | T
): Promise<T> {
  assertProductUpdatePermissions(principal, input)
  return work()
}
