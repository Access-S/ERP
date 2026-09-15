"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  assertCustomerOrderPermission,
  runAuthorizedCustomerOrderOperation,
} from "../services/customer-order-authorization"
import {
  addBlanketAmendment,
  cancelBlanketRelease,
  createBlanketCustomerOrder,
  createBlanketRelease,
  updateBlanketRelease,
} from "../services/blanket-customer-order-service"
import {
  createStandardCustomerOrder,
  cancelStandardCustomerOrder,
  CustomerOrderWorkflowError,
  updateStandardCustomerOrder,
} from "../services/customer-order-service"
import {
  addBlanketAmendmentInputSchema,
  createBlanketCustomerOrderInputSchema,
  createBlanketReleaseInputSchema,
  createStandardCustomerOrderInputSchema,
  cancelCustomerOrderInputSchema,
  updateBlanketReleaseInputSchema,
  updateStandardCustomerOrderInputSchema,
  type CustomerOrderMutationResult,
} from "../types/customer-order-schema"

function failure(message: string): CustomerOrderMutationResult {
  return { success: false, message }
}

function revalidateCustomerOrder(orderId: string) {
  revalidatePath("/customer-orders")
  revalidatePath(`/customer-orders/${orderId}`)
  revalidatePath(`/customer-orders/${orderId}/releases/new`)
}

export async function createBlanketCustomerOrderAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "create")
    const parsed = createBlanketCustomerOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Blanket PO.")
    }
    return runAuthorizedCustomerOrderOperation(principal, "create", async () => {
      const result = await createBlanketCustomerOrder(parsed.data, principal)
      revalidateCustomerOrder(result.orderId)
      return {
        success: true,
        message: "Blanket PO created and ready to receive releases.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function addBlanketAmendmentAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "amendBlanket")
    const parsed = addBlanketAmendmentInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Blanket PO top-up.")
    }
    return runAuthorizedCustomerOrderOperation(principal, "amendBlanket", async () => {
      const result = await addBlanketAmendment(parsed.data, principal)
      revalidateCustomerOrder(result.orderId)
      return {
        success: true,
        message: "Blanket PO top-up recorded without changing the original authority.",
        orderId: result.orderId,
        status: result.status,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function createBlanketReleaseAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "createRelease")
    const parsed = createBlanketReleaseInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Blanket release.")
    }
    return runAuthorizedCustomerOrderOperation(principal, "createRelease", async () => {
      const result = await createBlanketRelease(parsed.data, principal)
      revalidateCustomerOrder(result.orderId)
      return {
        success: true,
        message: result.status === "READY_FOR_PLANNING"
          ? "Blanket release created, committed, and ready for planning."
          : "Blanket release saved with checks that require correction.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateBlanketReleaseAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "editRelease")
    const parsed = updateBlanketReleaseInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Blanket release.")
    }
    return runAuthorizedCustomerOrderOperation(principal, "editRelease", async () => {
      const result = await updateBlanketRelease(parsed.data, principal)
      revalidateCustomerOrder(result.orderId)
      revalidatePath(`/customer-orders/${result.orderId}/releases/${result.releaseId}/edit`)
      return {
        success: true,
        message: result.status === "READY_FOR_PLANNING"
          ? "Blanket release corrected, committed, and ready for planning."
          : "Blanket release saved, but checks still require correction.",
        ...result,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function cancelBlanketReleaseAction(
  input: unknown
): Promise<CustomerOrderMutationResult> {
  try {
    const principal = await requireUser()
    assertCustomerOrderPermission(principal, "cancel")
    const parsed = cancelCustomerOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid release cancellation request.")
    }
    return runAuthorizedCustomerOrderOperation(principal, "cancel", async () => {
      const result = await cancelBlanketRelease(parsed.data, principal)
      revalidateCustomerOrder(result.orderId)
      return {
        success: true,
        message: "Blanket release cancelled and eligible committed value returned.",
        orderId: result.orderId,
        releaseId: result.releaseId,
        status: result.status,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
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
