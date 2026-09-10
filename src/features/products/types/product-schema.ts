import { z } from "zod"

export const productBomStateSchema = z.enum(["ACTIVE", "MISSING"])

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  product_code: z.string().min(1),
  description: z.string().nullable(),
  customer_id: z.string().uuid().nullable(),
  customer_code: z.string().nullable(),
  customer_name: z.string().nullable(),
  units_per_shipper: z.number().int().nullable(),
  uom: z.string(),
  is_active: z.boolean(),
  bom_state: productBomStateSchema,
  active_bom_id: z.string().uuid().nullable(),
  active_bom_revision: z.number().int().positive().nullable(),
  component_count: z.number().int().nonnegative(),
  updated_at: z.string().datetime(),
})

export const productBomRevisionSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  component_count: z.number().int().nonnegative(),
  effective_from: z.string().nullable(),
  effective_to: z.string().nullable(),
  updated_at: z.string().datetime(),
})

export const productDetailSchema = productListItemSchema.extend({
  category: z.string().nullable(),
  daily_run_rate: z.number().nullable(),
  hourly_run_rate: z.number().nullable(),
  mins_per_shipper: z.number().nullable(),
  price_per_shipper: z.number().nullable(),
  created_at: z.string().datetime(),
  active_bom_count: z.number().int().nonnegative(),
  draft_bom_count: z.number().int().nonnegative(),
  open_purchase_order_count: z.number().int().nonnegative(),
  bom_revisions: z.array(productBomRevisionSchema),
})

const optionalText = (label: string, maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maximum, `${label} must be ${maximum} characters or fewer.`).nullable()
  )

const optionalNumber = (label: string, maximum: number) =>
  z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : Number(value),
    z.number()
      .finite(`${label} must be a number.`)
      .min(0, `${label} cannot be negative.`)
      .max(maximum, `${label} is too large.`)
      .nullable()
  )

const optionalCustomerId = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.string().uuid("Invalid Customer.").nullable()
)

export const productOperationalFieldsSchema = z.object({
  description: optionalText("Description", 500),
  customerId: optionalCustomerId,
  unitsPerShipper: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? null : Number(value),
    z.number().int("Units per shipper must be a whole number.")
      .positive("Units per shipper must be greater than zero.")
      .max(1_000_000, "Units per shipper is too large.")
      .nullable()
  ),
  uom: z.string().trim().min(1, "Unit of measure is required.").max(32),
  category: optionalText("Category", 64),
  dailyRunRate: optionalNumber("Daily run rate", 1_000_000_000),
  hourlyRunRate: optionalNumber("Hourly run rate", 1_000_000_000),
  minsPerShipper: optionalNumber("Minutes per shipper", 1_000_000),
})

export const productCommercialFieldsSchema = z.object({
  pricePerShipper: optionalNumber("Price per shipper", 1_000_000_000),
})

export const productMasterFieldsSchema = productOperationalFieldsSchema.extend({
  pricePerShipper: productCommercialFieldsSchema.shape.pricePerShipper,
})

export const createProductInputSchema = productMasterFieldsSchema.extend({
  productCode: z.string().trim()
    .min(1, "Product code is required.")
    .max(64, "Product code must be 64 characters or fewer."),
})

export const updateProductInputSchema = z.object({
  productId: z.string().uuid("Invalid Product."),
  master: productOperationalFieldsSchema.optional(),
  commercial: productCommercialFieldsSchema.optional(),
}).refine(
  (input) => Boolean(input.master || input.commercial),
  { message: "No Product changes were submitted." }
)

export const setProductActiveSchema = z.object({
  productId: z.string().uuid("Invalid Product."),
  isActive: z.boolean(),
})

export const productMutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  productId: z.string().uuid().optional(),
  bomId: z.string().uuid().optional(),
})

export type ProductBomState = z.infer<typeof productBomStateSchema>
export type ProductListItem = z.infer<typeof productListItemSchema>
export type ProductBomRevision = z.infer<typeof productBomRevisionSchema>
export type ProductDetail = z.infer<typeof productDetailSchema>
export type ProductMasterFields = z.infer<typeof productMasterFieldsSchema>
export type ProductOperationalFields = z.infer<typeof productOperationalFieldsSchema>
export type ProductCommercialFields = z.infer<typeof productCommercialFieldsSchema>
export type CreateProductInput = z.infer<typeof createProductInputSchema>
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>
export type SetProductActiveInput = z.infer<typeof setProductActiveSchema>
export type ProductMutationResult = z.infer<typeof productMutationResultSchema>
