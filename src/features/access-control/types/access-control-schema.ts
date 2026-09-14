import { z } from "zod"
import { sensitiveChangeReasonSchema } from "../../security-audit/types/sensitive-change-reason.ts"

export const assignUserRolesSchema = z.object({
  userId: z.string().uuid("Invalid user."),
  roleIds: z
    .array(z.string().uuid("Invalid role."))
    .min(1, "Assign at least one role.")
    .max(32, "Too many roles were selected.")
    .transform((roleIds) => [...new Set(roleIds)]),
  reason: sensitiveChangeReasonSchema,
})

export const setUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user."),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
  reason: sensitiveChangeReasonSchema,
})

const normalizedRoleNameSchema = z
  .string()
  .trim()
  .min(2, "Role name must contain at least 2 characters.")
  .max(80, "Role name cannot exceed 80 characters.")
  .transform((value) => value.replace(/\s+/g, " "))

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Description cannot exceed 500 characters.")
  .transform((value) => value || null)

const permissionIdsSchema = z
  .array(z.string().uuid("Invalid permission."))
  .min(1, "Select at least one permission.")
  .max(200, "Too many permissions were selected.")
  .transform((permissionIds) => [...new Set(permissionIds)])

export const createCustomRoleSchema = z.object({
  name: normalizedRoleNameSchema,
  description: roleDescriptionSchema,
  permissionIds: permissionIdsSchema,
})

export const updateCustomRoleSchema = createCustomRoleSchema.extend({
  roleId: z.string().uuid("Invalid role."),
  reason: sensitiveChangeReasonSchema,
})

export const setCustomRoleActiveSchema = z.object({
  roleId: z.string().uuid("Invalid role."),
  isActive: z.boolean(),
  reason: sensitiveChangeReasonSchema,
})

export type AccessControlMutationResult = {
  success: boolean
  message: string
  requiresReauthentication?: boolean
  roleId?: string
}
