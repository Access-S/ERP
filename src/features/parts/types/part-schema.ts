// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import { z } from "zod"

// ───────────────── BLOCK 2: List Schema ──────────────────────────────────────
export const partSchema = z.object({
  id: z.string().uuid(),
  part_code: z.string().min(1, "Part code is required"),
  description: z.string().nullable(),
  part_type: z.string().nullable(),
  default_uom: z.string().nullable(),
  is_active: z.boolean(),
  bom_count: z.number().int().nonnegative(),
  line_count: z.number().int().nonnegative(),
  updated_at: z.string().datetime(),
})

// ───────────────── BLOCK 3: Detail Schema ────────────────────────────────────
export const partWhereUsedSchema = z.object({
  bom_id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_code: z.string(),
  product_description: z.string().nullable(),
  revision: z.number().int().positive(),
  bom_status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  quantity: z.number().nullable(),
  uom: z.string().nullable(),
})

export const partDetailSchema = partSchema.extend({
  normalized_code: z.string(),
  created_at: z.string().datetime(),
  active_bom_count: z.number().int().nonnegative(),
  where_used: z.array(partWhereUsedSchema),
})

const optionalText = (label: string, maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maximum, `${label} must be ${maximum} characters or fewer.`).nullable()
  )

export const createPartInputSchema = z.object({
  partCode: z.string().trim()
    .min(1, "Part code is required.")
    .max(64, "Part code must be 64 characters or fewer."),
  description: optionalText("Description", 500),
  partType: optionalText("Part type", 64),
  defaultUom: optionalText("Default UOM", 32),
})

export const updatePartInputSchema = z.object({
  partId: z.string().uuid("Invalid Part."),
  description: optionalText("Description", 500),
  partType: optionalText("Part type", 64),
  defaultUom: optionalText("Default UOM", 32),
})

export const setPartActiveSchema = z.object({
  partId: z.string().uuid("Invalid Part."),
  isActive: z.boolean(),
})

export const partMutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  partId: z.string().uuid().optional(),
})

// ───────────────── BLOCK 4: Type Inference ───────────────────────────────────
export type Part = z.infer<typeof partSchema>
export type PartWhereUsed = z.infer<typeof partWhereUsedSchema>
export type PartDetail = z.infer<typeof partDetailSchema>
export type CreatePartInput = z.infer<typeof createPartInputSchema>
export type UpdatePartInput = z.infer<typeof updatePartInputSchema>
export type SetPartActiveInput = z.infer<typeof setPartActiveSchema>
export type PartMutationResult = z.infer<typeof partMutationResultSchema>
