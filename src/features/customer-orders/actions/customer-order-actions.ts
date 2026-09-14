"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  assertCustomerOrderPermission,
  runAuthorizedCustomerOrderOperation,
} from "../services/customer-order-authorization"
import {
  createStandardCustomerOrder,
  cancelStandardCustomerOrder,
  CustomerOrderWorkflowError,
  updateStandardCustomerOrder,
} from "../services/customer-order-service"
import {
  createStandardCustomerOrderInputSchema,
  cancelCustomerOrderInputSchema,
  updateStandardCustomerOrderInputSchema,
  type CustomerOrderMutationResult,
} from "../types/customer-order-schema"

function failure(message: string): CustomerOrderMutationResult {
  return { success: false, message }
}

export async function updateStandardCustomerOrderAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "edit")
    assertCustomerOrderPermission(principal, "editRelease")
    const parsed = updateStandardCustomerOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Customer Order.")
    }

    return runAuthorizedCustomerOrderOperation(principal, "editRelease", async () => {
      const result = await updateStandardCustomerOrder(parsed.data, principal)
      revalidatePath("/customer-orders")
      revalidatePath(`/customer-orders/${result.orderId}`)
      revalidatePath(`/customer-orders/${result.orderId}/edit`)
      return {
        success: true,
        message:
          result.status === "READY_FOR_PLANNING"
            ? "Customer PO corrected and ready for planning."
            : "Customer PO saved, but checks still require correction.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function cancelStandardCustomerOrderAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "cancel")
    const parsed = cancelCustomerOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid cancellation request.")
    }

    return runAuthorizedCustomerOrderOperation(principal, "cancel", async () => {
      const result = await cancelStandardCustomerOrder(parsed.data, principal)
      revalidatePath("/customer-orders")
      revalidatePath(`/customer-orders/${result.orderId}`)
      return {
        success: true,
        message: "Customer PO cancelled with its history retained.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

function mutationFailure(error: unknown): CustomerOrderMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to perform this Customer Order action."
    )
  }
  if (error instanceof CustomerOrderWorkflowError) return failure(error.message)
  if (error instanceof Error && error.name === "CustomerOrderCommitmentError") {
    return failure(error.message)
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") {
      return failure("That Customer PO number already exists for the selected Customer.")
    }
    if (error.code === "P2034") {
      return failure("Another order changed at the same time. Please try again.")
    }
  }
  console.error("Customer Order mutation failed", error)
  return failure("The Customer Order could not be saved. Please try again.")
}

export async function createStandardCustomerOrderAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "create")
    const parsed = createStandardCustomerOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Customer Order.")
    }

    return runAuthorizedCustomerOrderOperation(principal, "create", async () => {
      const result = await createStandardCustomerOrder(parsed.data, principal)
      revalidatePath("/customer-orders")
      revalidatePath(`/customer-orders/${result.orderId}`)
      return {
        success: true,
        message:
          result.status === "READY_FOR_PLANNING"
            ? "Customer PO created and ready for planning."
            : "Customer PO created with checks that require correction.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}
