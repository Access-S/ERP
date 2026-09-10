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
  assignUserRolesSchema,
  setUserStatusSchema,
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
  console.error("Access control mutation failed", error)
  return failure("Access could not be updated. Please try again.")
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
