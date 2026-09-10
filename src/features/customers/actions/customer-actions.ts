"use server"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  createCustomer,
  CustomerWorkflowError,
  getCustomersPage,
  setCustomerActive,
  updateCustomer,
} from "../services/customer-service"
import {
  createCustomerInputSchema,
  setCustomerActiveSchema,
  updateCustomerInputSchema,
  type Customer,
  type CustomerMutationResult,
  type CreateCustomerInput,
} from "../types/customer-schema"
import {
  assertCustomerPermission,
  getCustomerStatusOperation,
  runAuthorizedCustomerCreate,
  runAuthorizedCustomerOperation,
  runAuthorizedCustomerUpdate,
} from "../services/customer-authorization"

function failure(message: string): CustomerMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): CustomerMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to perform this Customer action."
    )
  }
  if (error instanceof CustomerWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another update happened at the same time. Please try again.")
  }
  console.error("Customer mutation failed", error)
  return failure("The Customer could not be updated. Please try again.")
}

function revalidateCustomerPaths(customerId: string) {
  revalidatePath("/products")
  revalidatePath("/products/customers")
  revalidatePath(`/products/customers/${customerId}`)
  revalidatePath(`/products/customers/${customerId}/edit`)
  revalidatePath("/products/catalog")
  revalidatePath("/purchase-orders")
}

function hasInitialContactValues(input: CreateCustomerInput): boolean {
  return Boolean(
    input.primaryContactName ||
    input.primaryContactEmail ||
    input.primaryContactPhone
  )
}

function hasInitialFinancialValues(input: CreateCustomerInput): boolean {
  return Boolean(
    input.paymentTerms ||
    input.creditLimit !== 0 ||
    input.defaultCurrency !== "AUD" ||
    input.defaultDiscountPercentage !== 0 ||
    input.taxId ||
    input.isTaxExempt ||
    input.accountsPayablesEmail
  )
}

// ───────────────── BLOCK 2: Server Actions ─────────────────────
/**
 * Thin Server Action wrapper (Rule 2: UI → Server Action → Service → Prisma).
 * It authorizes and validates input before calling the Service. No Prisma
 * queries or Customer workflow rules live here.
 */
export async function fetchCustomersPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Customer>> {
  const principal = await requireUser()
  return runAuthorizedCustomerOperation(principal, "view", () => {
    const validated = dataTableRequestSchema.parse(params)
    return getCustomersPage(validated)
  })
}

export async function createCustomerAction(input: unknown): Promise<CustomerMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerPermission(principal, "create")
    const parsed = createCustomerInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")
    }

    return runAuthorizedCustomerCreate(
      principal,
      {
        contacts: hasInitialContactValues(parsed.data) ? parsed.data : undefined,
        financial: hasInitialFinancialValues(parsed.data) ? parsed.data : undefined,
      },
      async () => {
        const result = await createCustomer(parsed.data)
        revalidateCustomerPaths(result.customerId)
        return { success: true, message: "Customer created.", customerId: result.customerId }
      }
    )
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateCustomerAction(input: unknown): Promise<CustomerMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerPermission(principal, "view")
    const parsed = updateCustomerInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")
    }

    return runAuthorizedCustomerUpdate(principal, parsed.data, async () => {
      const result = await updateCustomer(parsed.data)
      revalidateCustomerPaths(result.customerId)
      return { success: true, message: "Customer updated.", customerId: result.customerId }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setCustomerActiveAction(input: unknown): Promise<CustomerMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerPermission(principal, "view")
    const parsed = setCustomerActiveSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")
    }

    return runAuthorizedCustomerOperation(
      principal,
      getCustomerStatusOperation(parsed.data.isActive),
      async () => {
        const result = await setCustomerActive(parsed.data)
        revalidateCustomerPaths(result.customerId)
        return {
          success: true,
          message: parsed.data.isActive ? "Customer reactivated." : "Customer deactivated.",
          customerId: result.customerId,
        }
      }
    )
  } catch (error) {
    return mutationFailure(error)
  }
}
