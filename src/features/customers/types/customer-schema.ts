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

export const customerProductSchema = z.object({
  id: z.string().uuid(),
  product_code: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
})

export const customerDetailSchema = customerSchema.extend({
  default_discount_percentage: z.number(),
  tax_id: z.string().nullable(),
  is_tax_exempt: z.boolean(),
  primary_contact_name: z.string().nullable(),
  primary_contact_email: z.string().nullable(),
  primary_contact_phone: z.string().nullable(),
  accounts_payables_email: z.string().nullable(),
  notes: z.string().nullable(),
  active_product_count: z.number().int().nonnegative(),
  open_purchase_order_count: z.number().int().nonnegative(),
  products: z.array(customerProductSchema),
})

const optionalText = (label: string, maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(maximum, `${label} must be ${maximum} characters or fewer.`).nullable()
  )

const optionalEmail = (label: string) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().email(`${label} must be a valid email address.`).max(254).nullable()
  )

export const customerIdentityFieldsSchema = z.object({
  legalName: z.string().trim().min(1, "Legal name is required.").max(200),
  tradingName: optionalText("Trading name", 200),
  customerType: z.string().trim().min(1, "Customer type is required.").max(64),
  industry: optionalText("Industry", 100),
  notes: optionalText("Notes", 2_000),
})

export const customerContactFieldsSchema = z.object({
  primaryContactName: optionalText("Primary contact name", 200),
  primaryContactEmail: optionalEmail("Primary contact email"),
  primaryContactPhone: optionalText("Primary contact phone", 64),
})

export const customerFinancialFieldsSchema = z.object({
  paymentTerms: optionalText("Payment terms", 100),
  creditLimit: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? 0 : Number(value),
    z.number().finite().min(0, "Credit limit cannot be negative.").max(1_000_000_000)
  ),
  defaultCurrency: z.string().trim().length(3, "Currency must be a three-letter code.")
    .transform((value) => value.toUpperCase()),
  defaultDiscountPercentage: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? 0 : Number(value),
    z.number().finite().min(0, "Discount cannot be negative.").max(100, "Discount cannot exceed 100%.")
  ),
  taxId: optionalText("Tax ID", 64),
  isTaxExempt: z.boolean(),
  accountsPayablesEmail: optionalEmail("Accounts payable email"),
})

export const customerMasterFieldsSchema = customerIdentityFieldsSchema
  .merge(customerContactFieldsSchema)
  .merge(customerFinancialFieldsSchema)

export const createCustomerInputSchema = customerMasterFieldsSchema.extend({
  customerCode: z.string().trim()
    .min(1, "Customer code is required.")
    .max(64, "Customer code must be 64 characters or fewer."),
})

export const updateCustomerInputSchema = z.object({
  customerId: z.string().uuid("Invalid Customer."),
  identity: customerIdentityFieldsSchema.optional(),
  contacts: customerContactFieldsSchema.optional(),
  financial: customerFinancialFieldsSchema.optional(),
}).refine(
  (value) => value.identity || value.contacts || value.financial,
  "At least one Customer field group must be provided."
)

export const setCustomerActiveSchema = z.object({
  customerId: z.string().uuid("Invalid Customer."),
  isActive: z.boolean(),
})

export const customerMutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  customerId: z.string().uuid().optional(),
})

// ───────────────── BLOCK 3: Type Inference ────────────────────
export type Customer = z.infer<typeof customerSchema>
export type CustomerProduct = z.infer<typeof customerProductSchema>
export type CustomerDetail = z.infer<typeof customerDetailSchema>
export type CustomerIdentityFields = z.infer<typeof customerIdentityFieldsSchema>
export type CustomerContactFields = z.infer<typeof customerContactFieldsSchema>
export type CustomerFinancialFields = z.infer<typeof customerFinancialFieldsSchema>
export type CustomerMasterFields = z.infer<typeof customerMasterFieldsSchema>
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>
export type SetCustomerActiveInput = z.infer<typeof setCustomerActiveSchema>
export type CustomerMutationResult = z.infer<typeof customerMutationResultSchema>
