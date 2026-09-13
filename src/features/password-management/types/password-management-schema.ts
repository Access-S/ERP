import { z } from "zod"
import { passwordSchema } from "@/features/user-onboarding/types/user-onboarding-schema"

export const PASSWORD_RESET_TTL_HOURS = 1

const currentPasswordSchema = z
  .string()
  .min(1, "Current password is required.")
  .max(128, "Current password is too long.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Current password is too long."
  )

export const passwordResetTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid password reset link.")

export const createPasswordResetSchema = z.object({
  userId: z.string().uuid("Invalid user."),
})

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Choose a password different from your current password.",
    path: ["newPassword"],
  })

export const resetPasswordSchema = z
  .object({
    token: passwordResetTokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export type PasswordMutationResult = {
  success: boolean
  message: string
  resetPath?: string
  expiresAt?: string
}
