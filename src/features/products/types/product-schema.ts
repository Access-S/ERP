// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from "zod"

// ───────────────── BLOCK 2: Zod Schemas ────────────────────────
export const productSchema = z.object({
  id: z.string().uuid(),
  product_code: z.string().min(1, "Product code is required"),
  description: z.string().nullable(),
  units_per_shipper: z.number().int().nullable(),
  daily_run_rate: z.number().nullable(),
  hourly_run_rate: z.number().nullable(),
  mins_per_shipper: z.number().nullable(),
  price_per_shipper: z.number().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
})

// Schema for creating a new product (omits system-generated fields)
export const createProductSchema = productSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

// ───────────────── BLOCK 3: Type Inference ────────────────────
export type Product = z.infer<typeof productSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>