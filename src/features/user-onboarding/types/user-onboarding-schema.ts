import { z } from "zod"
import { sensitiveChangeReasonSchema } from "../../security-audit/types/sensitive-change-reason.ts"

export const INVITATION_TTL_HOURS = 48
export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_BYTES = 72

const normalizedEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email cannot exceed 254 characters.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase())

const normalizedNameSchema = z
  .string()
  .trim()
  .min(2, "Name must contain at least 2 characters.")
  .max(100, "Name cannot exceed 100 characters.")
  .transform((value) => value.replace(/\s+/g, " "))

const roleIdsSchema = z
  .array(z.string().uuid("Invalid role."))
  .min(1, "Assign at least one role.")
  .max(32, "Too many roles were selected.")
  .transform((roleIds) => [...new Set(roleIds)])

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid activation link.")

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Password is too long.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    `Password cannot exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`
  )

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password is too long.")
    .refine(
      (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
      "Password is too long."
    ),
})

export const inviteUserSchema = z.object({
  name: normalizedNameSchema,
  email: normalizedEmailSchema,
  roleIds: roleIdsSchema,
})

export const reissueInvitationSchema = z.object({
  userId: z.string().uuid("Invalid user."),
  reason: sensitiveChangeReasonSchema,
})

export const activateAccountSchema = z
  .object({
    token: invitationTokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export type UserOnboardingMutationResult = {
  success: boolean
  message: string
  userId?: string
  activationPath?: string
  expiresAt?: string
}

export type AccountActivationResult = {
  success: boolean
  message: string
}
