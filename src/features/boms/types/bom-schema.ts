import { z } from "zod"

// ───────────────── BLOCK 1: Shared Enums ─────────────────
export const bomStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"])
export const bomHealthSchema = z.enum(["COMPLETE", "ATTENTION"])

// ───────────────── BLOCK 2: Read Schemas ─────────────────
export const bomListItemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_code: z.string(),
  product_description: z.string().nullable(),
  customer_name: z.string().nullable(),
  revision: z.number().int().positive(),
  status: bomStatusSchema,
  health: bomHealthSchema,
  component_count: z.number().int().nonnegative(),
  unique_part_count: z.number().int().nonnegative(),
  issue_count: z.number().int().nonnegative(),
  updated_at: z.string().datetime(),
})

export const bomLineItemSchema = z.object({
  id: z.string().uuid(),
  part_id: z.string().uuid(),
  part_code: z.string(),
  description: z.string().nullable(),
  part_type: z.string().nullable(),
  quantity: z.number().nullable(),
  uom: z.string().nullable(),
  is_active: z.boolean(),
  position: z.number().int().nullable(),
  issues: z.array(z.string()),
})

export const bomDetailSchema = bomListItemSchema.extend({
  quantity_basis: z.string(),
  effective_from: z.string().nullable(),
  effective_to: z.string().nullable(),
  created_at: z.string().datetime(),
  health_issues: z.array(z.string()),
  lines: z.array(bomLineItemSchema),
})

// ───────────────── BLOCK 3: Mutation Schemas ─────────────────
const quantitySchema = z.number()
  .positive("Quantity must be greater than zero")
  .max(1_000_000, "Quantity cannot exceed 1,000,000")
  .refine(
    (value) => {
      const [, decimals = ""] = value.toString().split(".")
      return decimals.length <= 8
    },
    "Quantity cannot have more than 8 decimal places"
  )

export const createBomDraftSchema = z.object({
  sourceBomId: z.string().uuid(),
})

export const addBomLineSchema = z.object({
  bomId: z.string().uuid(),
  partId: z.string().uuid(),
  quantity: quantitySchema,
  uom: z.string().trim().min(1, "Unit of measure is required").max(32),
})

export const updateBomLineSchema = z.object({
  bomId: z.string().uuid(),
  lineId: z.string().uuid(),
  quantity: quantitySchema,
  uom: z.string().trim().min(1, "Unit of measure is required").max(32),
})

export const removeBomLineSchema = z.object({
  bomId: z.string().uuid(),
  lineId: z.string().uuid(),
})

export const activateBomSchema = z.object({
  bomId: z.string().uuid(),
})

export const bomPartOptionSchema = z.object({
  id: z.string().uuid(),
  part_code: z.string(),
  description: z.string().nullable(),
  part_type: z.string().nullable(),
  default_uom: z.string().nullable(),
})

export const bomMutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  bomId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
})

// ───────────────── BLOCK 4: Type Inference ─────────────────
export type BomStatus = z.infer<typeof bomStatusSchema>
export type BomHealth = z.infer<typeof bomHealthSchema>
export type BomListItem = z.infer<typeof bomListItemSchema>
export type BomLineItem = z.infer<typeof bomLineItemSchema>
export type BomDetail = z.infer<typeof bomDetailSchema>
export type CreateBomDraftInput = z.infer<typeof createBomDraftSchema>
export type AddBomLineInput = z.infer<typeof addBomLineSchema>
export type UpdateBomLineInput = z.infer<typeof updateBomLineSchema>
export type RemoveBomLineInput = z.infer<typeof removeBomLineSchema>
export type ActivateBomInput = z.infer<typeof activateBomSchema>
export type BomPartOption = z.infer<typeof bomPartOptionSchema>
export type BomMutationResult = z.infer<typeof bomMutationResultSchema>
