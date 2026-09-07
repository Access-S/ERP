// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from "zod"

// ───────────────── BLOCK 2: Zod Schemas ────────────────────────
export const partSchema = z.object({
  id: z.string().uuid(),
  part_code: z.string().min(1, "Part code is required"),
  part_description: z.string().nullable(),
  part_type: z.string().nullable(),
  per_shipper: z.number().nullable(),
  product_id: z.string().uuid().nullable(),
  product_code: z.string().nullable(),
})

// ───────────────── BLOCK 3: Type Inference ────────────────────
export type Part = z.infer<typeof partSchema>
