import { z } from "zod"

const decimalPattern = /^\d{1,16}(?:\.\d{1,6})?$/
const moneyPattern = /^\d{1,16}(?:\.\d{1,2})?$/

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const calendarDate = (label: string) =>
  z.string().trim().refine(isCalendarDate, `${label} must be a valid date.`)

const optionalCalendarDate = (label: string) =>
  z.string().trim().refine(
    (value) => value === "" || isCalendarDate(value),
    `${label} must be a valid date.`
  )

const positiveQuantity = z.string().trim()
  .regex(decimalPattern, "Quantity must be a positive number with up to 6 decimal places.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.")

const nonNegativeMoney = (label: string) =>
  z.string().trim().regex(
    moneyPattern,
    `${label} must be zero or greater with no more than 2 decimal places.`
  )

export const standardCustomerOrderLineInputSchema = z.object({
  productId: z.string().uuid("Select a valid Product."),
  orderUom: z.enum(["UNIT", "SHIPPER"]),
  orderedQuantity: positiveQuantity,
  requestedDeliveryDate: optionalCalendarDate("Requested delivery date"),
  customerLineValue: nonNegativeMoney("Customer line value"),
})

export const createStandardCustomerOrderInputSchema = z.object({
  customerId: z.string().uuid("Select a valid Customer."),
  customerPoNumber: z.string().trim()
    .min(1, "Customer PO number is required.")
    .max(100, "Customer PO number must be 100 characters or fewer."),
  receivedDate: calendarDate("Received date"),
  customerReleaseReference: z.string().trim()
    .max(100, "Customer release reference must be 100 characters or fewer."),
  defaultRequestedDeliveryDate: optionalCalendarDate("Default requested delivery date"),
  customerNetTotal: nonNegativeMoney("Customer PO total"),
  lines: z.array(standardCustomerOrderLineInputSchema)
    .min(1, "Add at least one Product line.")
    .max(100, "A Customer PO can contain at most 100 lines."),
})

export const updateStandardCustomerOrderInputSchema =
  createStandardCustomerOrderInputSchema.extend({
    orderId: z.string().uuid("Invalid Customer Order."),
    releaseId: z.string().uuid("Invalid Customer Order release."),
  })

export const customerOrderMutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  orderId: z.string().uuid().optional(),
  releaseId: z.string().uuid().optional(),
  status: z.enum(["PO_CHECK", "READY_FOR_PLANNING", "CANCELLED"]).optional(),
  issueCodes: z.array(z.string()).optional(),
})

export const cancelCustomerOrderInputSchema = z.object({
  orderId: z.string().uuid("Invalid Customer Order."),
  releaseId: z.string().uuid("Invalid Customer Order release."),
  reason: z.string().trim()
    .min(10, "Cancellation reason must be at least 10 characters.")
    .max(500, "Cancellation reason must be 500 characters or fewer."),
})

export type CancelCustomerOrderInput = z.infer<typeof cancelCustomerOrderInputSchema>

export type StandardCustomerOrderLineInput = z.infer<
  typeof standardCustomerOrderLineInputSchema
>
export type CreateStandardCustomerOrderInput = z.infer<
  typeof createStandardCustomerOrderInputSchema
>
export type UpdateStandardCustomerOrderInput = z.infer<
  typeof updateStandardCustomerOrderInputSchema
>
export type CustomerOrderMutationResult = z.infer<
  typeof customerOrderMutationResultSchema
>
