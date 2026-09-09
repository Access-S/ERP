"use server"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
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
} from "../types/customer-schema"

async function isAuthenticated(): Promise<boolean> {
  const session = await auth()
  return Boolean(session?.user)
}

function failure(message: string): CustomerMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): CustomerMutationResult {
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

// ───────────────── BLOCK 2: Server Actions ─────────────────────
/**
 * Thin Server Action wrapper (Rule 2: UI → Server Action → Service → Prisma).
 * ONLY validates the incoming table request with Zod, then calls the Service.
 * No Prisma queries or business logic here.
 */
export async function fetchCustomersPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Customer>> {
  const validated = dataTableRequestSchema.parse(params)
  return getCustomersPage(validated)
}

export async function createCustomerAction(input: unknown): Promise<CustomerMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to create Customers.")
  const parsed = createCustomerInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")

  try {
    const result = await createCustomer(parsed.data)
    revalidateCustomerPaths(result.customerId)
    return { success: true, message: "Customer created.", customerId: result.customerId }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateCustomerAction(input: unknown): Promise<CustomerMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to edit Customers.")
  const parsed = updateCustomerInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")

  try {
    const result = await updateCustomer(parsed.data)
    revalidateCustomerPaths(result.customerId)
    return { success: true, message: "Customer updated.", customerId: result.customerId }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setCustomerActiveAction(input: unknown): Promise<CustomerMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to change Customer status.")
  const parsed = setCustomerActiveSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Customer.")

  try {
    const result = await setCustomerActive(parsed.data)
    revalidateCustomerPaths(result.customerId)
    return {
      success: true,
      message: parsed.data.isActive ? "Customer reactivated." : "Customer deactivated.",
      customerId: result.customerId,
    }
  } catch (error) {
    return mutationFailure(error)
  }
}
