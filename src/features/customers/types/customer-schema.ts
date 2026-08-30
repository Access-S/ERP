// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from "zod"

// ───────────────── BLOCK 2: Zod Schemas ────────────────────────
export const customerSchema = z.object({
  id: z.string().uuid(),
  customer_code: z.string().min(1, "Customer code is required"),
  legal_name: z.string().min(1, "Legal name is required"),
  trading_name: z.string().nullable(),
  status: z.string(),
  customer_type: z.string(),
  industry: z.string().nullable(),
  payment_terms: z.string().nullable(),
  credit_limit: z.number(),
  default_currency: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

// ───────────────── BLOCK 3: Type Inference ────────────────────
export type Customer = z.infer<typeof customerSchema>
