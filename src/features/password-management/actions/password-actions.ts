"use server"

import { revalidatePath } from "next/cache"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  requirePermission,
  requireUser,
} from "@/features/auth/services/authorization-service"
import {
  changeOwnPassword,
  createPasswordResetLink,
  PasswordWorkflowError,
  resetPassword,
} from "../services/password-service"
import {
  changePasswordSchema,
  createPasswordResetSchema,
  resetPasswordSchema,
  type PasswordMutationResult,
} from "../types/password-management-schema"

function failure(message: string): PasswordMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): PasswordMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to manage this password."
    )
  }
  if (error instanceof PasswordWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another security change happened at the same time. Please try again.")
  }
  console.error("Password mutation failed", error)
  return failure("The password operation could not be completed. Please try again.")
}

export async function changeOwnPasswordAction(
  input: unknown
): Promise<PasswordMutationResult> {
  try {
    const principal = await requireUser()
    const parsed = changePasswordSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid password details.")
    }
    await changeOwnPassword(
      principal.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    )
    return {
      success: true,
      message: "Password changed. Sign in again with your new password.",
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function createPasswordResetLinkAction(
  input: unknown
): Promise<PasswordMutationResult> {
  try {
    const principal = await requirePermission("admin.user.manage")
    const parsed = createPasswordResetSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid user.")
    }
    const reset = await createPasswordResetLink(parsed.data.userId, principal.userId)
    revalidatePath(`/settings/access/users/${parsed.data.userId}`)
    return {
      success: true,
      message: "Password reset link created. Share it through an approved channel.",
      resetPath: reset.resetPath,
      expiresAt: reset.expiresAt.toISOString(),
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function resetPasswordAction(input: unknown): Promise<PasswordMutationResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid password details.")
  }
  try {
    await resetPassword(parsed.data.token, parsed.data.password)
    return {
      success: true,
      message: "Password reset complete. Sign in with your new password.",
    }
  } catch (error) {
    return mutationFailure(error)
  }
}
