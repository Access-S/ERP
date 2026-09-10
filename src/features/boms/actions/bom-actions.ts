"use server"

// ───────────────── BLOCK 1: Imports ─────────────────
import { revalidatePath } from "next/cache"
import { requireUser } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import {
  activateBom,
  addBomLine,
  BomWorkflowError,
  createBomDraft,
  getBomsPage,
  removeBomLine,
  updateBomLine,
} from "../services/bom-service"
import {
  activateBomSchema,
  addBomLineSchema,
  createBomDraftSchema,
  removeBomLineSchema,
  updateBomLineSchema,
  type BomListItem,
  type BomMutationResult,
} from "../types/bom-schema"
import { runAuthorizedBomOperation } from "../services/bom-authorization"

// ───────────────── BLOCK 2: Action Helpers ─────────────────
function validationFailure(message: string): BomMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): BomMutationResult {
  if (isAuthorizationError(error)) {
    return validationFailure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to perform this BOM action."
    )
  }
  if (error instanceof BomWorkflowError) {
    return { success: false, message: error.message }
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return {
      success: false,
      message: "Another BOM update happened at the same time. Please try again.",
    }
  }
  console.error("BOM mutation failed", error)
  return {
    success: false,
    message: "The BOM could not be updated. Please try again.",
  }
}

function revalidateBomPaths(bomId: string, productId: string) {
  revalidatePath("/products")
  revalidatePath("/products/boms")
  revalidatePath(`/products/boms/${bomId}`)
  revalidatePath("/products/catalog")
  revalidatePath(`/products/catalog/${productId}`)
}

// ───────────────── BLOCK 3: Read Action ─────────────────
export async function fetchBomsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<BomListItem>> {
  const principal = await requireUser()
  return runAuthorizedBomOperation(principal, "view", () => {
    const validated = dataTableRequestSchema.parse(params)
    return getBomsPage(validated)
  })
}

// ───────────────── BLOCK 4: Mutation Actions ─────────────────
export async function createBomDraftAction(input: unknown): Promise<BomMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedBomOperation(principal, "createDraft", async () => {
      const parsed = createBomDraftSchema.safeParse(input)
      if (!parsed.success) {
        return validationFailure(parsed.error.issues[0]?.message ?? "Invalid BOM.")
      }

      const result = await createBomDraft(parsed.data)
      revalidateBomPaths(result.bomId, result.productId)
      return {
        success: true,
        message: result.created ? "Draft revision created." : "The existing draft was opened.",
        bomId: result.bomId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function addBomLineAction(input: unknown): Promise<BomMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedBomOperation(principal, "editDraft", async () => {
      const parsed = addBomLineSchema.safeParse(input)
      if (!parsed.success) {
        return validationFailure(parsed.error.issues[0]?.message ?? "Invalid BOM line.")
      }

      const result = await addBomLine(parsed.data)
      revalidateBomPaths(result.bomId, result.productId)
      return {
        success: true,
        message: "Part added to the draft BOM.",
        bomId: result.bomId,
        lineId: result.lineId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateBomLineAction(input: unknown): Promise<BomMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedBomOperation(principal, "editDraft", async () => {
      const parsed = updateBomLineSchema.safeParse(input)
      if (!parsed.success) {
        return validationFailure(parsed.error.issues[0]?.message ?? "Invalid BOM line.")
      }

      const result = await updateBomLine(parsed.data)
      revalidateBomPaths(result.bomId, result.productId)
      return {
        success: true,
        message: "BOM line updated.",
        bomId: result.bomId,
        lineId: result.lineId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function removeBomLineAction(input: unknown): Promise<BomMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedBomOperation(principal, "editDraft", async () => {
      const parsed = removeBomLineSchema.safeParse(input)
      if (!parsed.success) {
        return validationFailure(parsed.error.issues[0]?.message ?? "Invalid BOM line.")
      }

      const result = await removeBomLine(parsed.data)
      revalidateBomPaths(result.bomId, result.productId)
      return {
        success: true,
        message: "BOM line removed from the draft.",
        bomId: result.bomId,
        lineId: result.lineId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function activateBomAction(input: unknown): Promise<BomMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedBomOperation(principal, "activate", async () => {
      const parsed = activateBomSchema.safeParse(input)
      if (!parsed.success) {
        return validationFailure(parsed.error.issues[0]?.message ?? "Invalid BOM.")
      }

      const result = await activateBom(parsed.data)
      revalidateBomPaths(result.bomId, result.productId)
      return {
        success: true,
        message: "BOM activated and the previous active revision archived.",
        bomId: result.bomId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}
