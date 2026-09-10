import type { PermissionKey } from "../../auth/config/authorization-registry.ts"
import {
  assertPermission,
  hasPermission,
  type AuthorizationPrincipal,
} from "../../auth/services/authorization-policy.ts"

export type BomOperation =
  | "view"
  | "createDraft"
  | "editDraft"
  | "activate"

export const BOM_OPERATION_PERMISSIONS = {
  view: ["bom.view"],
  createDraft: ["bom.view", "bom.draft.create"],
  editDraft: ["bom.view", "bom.draft.edit", "part.view"],
  activate: ["bom.view", "bom.activate", "bom.archive"],
} as const satisfies Record<BomOperation, readonly PermissionKey[]>

export function hasBomPermission(
  principal: AuthorizationPrincipal,
  operation: BomOperation
): boolean {
  return BOM_OPERATION_PERMISSIONS[operation].every((permission) =>
    hasPermission(principal, permission)
  )
}

export function assertBomPermission(
  principal: AuthorizationPrincipal,
  operation: BomOperation
): void {
  for (const permission of BOM_OPERATION_PERMISSIONS[operation]) {
    assertPermission(principal, permission)
  }
}

export async function runAuthorizedBomOperation<T>(
  principal: AuthorizationPrincipal,
  operation: BomOperation,
  work: () => Promise<T> | T
): Promise<T> {
  assertBomPermission(principal, operation)
  return work()
}
