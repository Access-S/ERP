"use server"

import { revalidatePath } from "next/cache"
import { assertPermission, isAuthorizationError } from "@/features/auth/services/authorization-policy"
import { requirePermission } from "@/features/auth/services/authorization-service"
import {
  activateInvitedAccount,
  createInvitedUser,
  InvitationWorkflowError,
  reissueUserInvitation,
} from "../services/invitation-service"
import {
  activateAccountSchema,
  inviteUserSchema,
  reissueInvitationSchema,
  type AccountActivationResult,
  type UserOnboardingMutationResult,
} from "../types/user-onboarding-schema"

function failure(message: string): UserOnboardingMutationResult {
  return { success: false, message }
}

function adminMutationFailure(error: unknown): UserOnboardingMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to invite users."
    )
  }
  if (error instanceof InvitationWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return failure("A user with this email already exists.")
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another onboarding change happened at the same time. Please try again.")
  }
  console.error("User onboarding mutation failed", error)
  return failure("The invitation could not be created. Please try again.")
}

export async function inviteUserAction(
  input: unknown
): Promise<UserOnboardingMutationResult> {
  try {
    const principal = await requirePermission("admin.user.invite")
    assertPermission(principal, "admin.role.assign")
    const parsed = inviteUserSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid invitation details.")
    }

    const invitation = await createInvitedUser(parsed.data, principal.userId)
    revalidatePath("/settings/access")
    revalidatePath("/settings/access/users")
    revalidatePath(`/settings/access/users/${invitation.userId}`)
    return {
      success: true,
      message: "User invited. Share the activation link through an approved channel.",
      userId: invitation.userId,
      activationPath: invitation.activationPath,
      expiresAt: invitation.expiresAt.toISOString(),
    }
  } catch (error) {
    return adminMutationFailure(error)
  }
}

export async function reissueInvitationAction(
  input: unknown
): Promise<UserOnboardingMutationResult> {
  try {
    const principal = await requirePermission("admin.user.invite")
    const parsed = reissueInvitationSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid user.")
    }

    const invitation = await reissueUserInvitation(parsed.data.userId, principal.userId)
    revalidatePath("/settings/access/users")
    revalidatePath(`/settings/access/users/${parsed.data.userId}`)
    return {
      success: true,
      message: "A new activation link was created. The previous link no longer works.",
      userId: parsed.data.userId,
      activationPath: invitation.activationPath,
      expiresAt: invitation.expiresAt.toISOString(),
    }
  } catch (error) {
    return adminMutationFailure(error)
  }
}

export async function activateAccountAction(
  input: unknown
): Promise<AccountActivationResult> {
  const parsed = activateAccountSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid activation details.",
    }
  }

  try {
    await activateInvitedAccount(parsed.data.token, parsed.data.password)
    return { success: true, message: "Your account is ready. You can now sign in." }
  } catch (error) {
    if (error instanceof InvitationWorkflowError) {
      return { success: false, message: error.message }
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return { success: false, message: "Activation conflicted with another request. Try again." }
    }
    console.error("Account activation failed", error)
    return { success: false, message: "Your account could not be activated. Please try again." }
  }
}
