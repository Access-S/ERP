"use server"

import { revalidatePath } from "next/cache"
import { requirePermission } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  AccessControlWorkflowError,
  changeUserStatus,
  replaceUserRoleAssignments,
} from "../services/access-control-service"
import {
  createCustomRole,
  setCustomRoleActive,
  updateCustomRole,
} from "../services/custom-role-service"
import {
  assignUserRolesSchema,
  createCustomRoleSchema,
  setCustomRoleActiveSchema,
  setUserStatusSchema,
  updateCustomRoleSchema,
  type AccessControlMutationResult,
} from "../types/access-control-schema"

function failure(message: string): AccessControlMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): AccessControlMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to manage access."
    )
  }
  if (error instanceof AccessControlWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another access change happened at the same time. Please try again.")
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return failure("A role with this name or identifier already exists.")
  }
  console.error("Access control mutation failed", error)
  return failure("Access could not be updated. Please try again.")
}

function revalidateRolePaths(roleId?: string) {
  revalidatePath("/settings/access")
  revalidatePath("/settings/access/users")
  revalidatePath("/settings/access/roles")
  if (roleId) {
    revalidatePath(`/settings/access/roles/${roleId}`)
    revalidatePath(`/settings/access/roles/${roleId}/edit`)
  }
}

function revalidateAccessControl(userId: string) {
  revalidatePath("/settings/access")
  revalidatePath("/settings/access/users")
  revalidatePath(`/settings/access/users/${userId}`)
  revalidatePath("/settings/access/roles")
}

export async function assignUserRolesAction(
  input: unknown
): Promise<AccessControlMutationResult> {
  try {
    const principal = await requirePermission("admin.role.assign")
    const parsed = assignUserRolesSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid role assignment.")
    }

    const result = await replaceUserRoleAssignments(
      parsed.data.userId,
      parsed.data.roleIds,
      principal.userId
    )
    revalidateAccessControl(parsed.data.userId)
    return {
      success: true,
      message: result.changed ? "Role assignments updated." : "Role assignments are unchanged.",
      requiresReauthentication: result.changed && parsed.data.userId === principal.userId,
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setUserStatusAction(
  input: unknown
): Promise<AccessControlMutationResult> {
  try {
    const principal = await requirePermission("admin.user.manage")
    const parsed = setUserStatusSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid account status.")
    }

    const result = await changeUserStatus(
      parsed.data.userId,
      parsed.data.status,
      principal.userId
    )
    revalidateAccessControl(parsed.data.userId)
    return {
      success: true,
      message: result.changed ? "Account status updated." : "Account status is unchanged.",
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function createCustomRoleAction(
  input: unknown
): Promise<AccessControlMutationResult> {
  try {
    const principal = await requirePermission("admin.role.manage")
    const parsed = createCustomRoleSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid custom role.")
    }

    const role = await createCustomRole(parsed.data, principal.userId)
    revalidateRolePaths(role.id)
    return { success: true, message: "Custom role created.", roleId: role.id }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateCustomRoleAction(
  input: unknown
): Promise<AccessControlMutationResult> {
  try {
    const principal = await requirePermission("admin.role.manage")
    const parsed = updateCustomRoleSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid custom role.")
    }

    const result = await updateCustomRole(
      parsed.data.roleId,
      parsed.data,
      principal.userId
    )
    revalidateRolePaths(result.id)
    return {
      success: true,
      message: result.changed ? "Custom role updated." : "Custom role is unchanged.",
      roleId: result.id,
      requiresReauthentication: result.affectedUserIds.includes(principal.userId),
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setCustomRoleActiveAction(
  input: unknown
): Promise<AccessControlMutationResult> {
  try {
    const principal = await requirePermission("admin.role.manage")
    const parsed = setCustomRoleActiveSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid custom role status.")
    }

    const result = await setCustomRoleActive(
      parsed.data.roleId,
      parsed.data.isActive,
      principal.userId
    )
    revalidateRolePaths(result.id)
    return {
      success: true,
      message: result.changed
        ? parsed.data.isActive
          ? "Custom role reactivated."
          : "Custom role archived."
        : "Custom role status is unchanged.",
      roleId: result.id,
      requiresReauthentication: result.affectedUserIds.includes(principal.userId),
    }
  } catch (error) {
    return mutationFailure(error)
  }
}
