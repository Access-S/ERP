import type { PermissionKey } from "../../auth/config/authorization-registry.ts"
import {
  assertPermission,
  hasPermission,
  type AuthorizationPrincipal,
} from "../../auth/services/authorization-policy.ts"

export type PartOperation =
  | "view"
  | "create"
  | "edit"
  | "deactivate"
  | "reactivate"

export const PART_OPERATION_PERMISSIONS = {
  view: "part.view",
  create: "part.create",
  edit: "part.edit",
  deactivate: "part.deactivate",
  reactivate: "part.reactivate",
} as const satisfies Record<PartOperation, PermissionKey>

export function getPartStatusOperation(nextIsActive: boolean): PartOperation {
  return nextIsActive ? "reactivate" : "deactivate"
}

export function hasPartPermission(
  principal: AuthorizationPrincipal,
  operation: PartOperation
): boolean {
  return hasPermission(principal, PART_OPERATION_PERMISSIONS[operation])
}

export function assertPartPermission(
  principal: AuthorizationPrincipal,
  operation: PartOperation
): void {
  assertPermission(principal, PART_OPERATION_PERMISSIONS[operation])
}

export async function runAuthorizedPartOperation<T>(
  principal: AuthorizationPrincipal,
  operation: PartOperation,
  work: () => Promise<T> | T
): Promise<T> {
  assertPartPermission(principal, operation)
  return work()
}
