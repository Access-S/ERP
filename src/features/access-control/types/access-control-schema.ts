import { z } from "zod"

export const assignUserRolesSchema = z.object({
  userId: z.string().uuid("Invalid user."),
  roleIds: z
    .array(z.string().uuid("Invalid role."))
    .min(1, "Assign at least one role.")
    .max(32, "Too many roles were selected.")
    .transform((roleIds) => [...new Set(roleIds)]),
})

export const setUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user."),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
})

export type AccessControlMutationResult = {
  success: boolean
  message: string
  requiresReauthentication?: boolean
}
