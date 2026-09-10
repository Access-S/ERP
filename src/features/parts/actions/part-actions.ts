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
  createPart,
  getPartsPage,
  PartWorkflowError,
  setPartActive,
  updatePart,
} from "../services/part-service"
import {
  createPartInputSchema,
  setPartActiveSchema,
  updatePartInputSchema,
  type Part,
  type PartMutationResult,
} from "../types/part-schema"
import {
  getPartStatusOperation,
  runAuthorizedPartOperation,
} from "../services/part-authorization"

function failure(message: string): PartMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): PartMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to perform this Part action."
    )
  }
  if (error instanceof PartWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another update happened at the same time. Please try again.")
  }
  console.error("Part mutation failed", error)
  return failure("The Part could not be updated. Please try again.")
}

function revalidatePartPaths(partId: string) {
  revalidatePath("/products")
  revalidatePath("/products/parts")
  revalidatePath(`/products/parts/${partId}`)
  revalidatePath(`/products/parts/${partId}/edit`)
  revalidatePath("/products/boms")
}

// ───────────────── BLOCK 2: Server Actions ─────────────────────
/**
 * Thin Server Action wrapper (Rule 2: UI → Server Action → Service → Prisma).
 * ONLY validates the incoming table request with Zod, then calls the Service.
 * No Prisma queries or business logic here.
 */
export async function fetchPartsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Part>> {
  const principal = await requireUser()
  return runAuthorizedPartOperation(principal, "view", () => {
    const validated = dataTableRequestSchema.parse(params)
    return getPartsPage(validated)
  })
}

export async function createPartAction(input: unknown): Promise<PartMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedPartOperation(principal, "create", async () => {
      const parsed = createPartInputSchema.safeParse(input)
      if (!parsed.success) {
        return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")
      }

      const result = await createPart(parsed.data)
      revalidatePartPaths(result.partId)
      return { success: true, message: "Part created.", partId: result.partId }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updatePartAction(input: unknown): Promise<PartMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedPartOperation(principal, "edit", async () => {
      const parsed = updatePartInputSchema.safeParse(input)
      if (!parsed.success) {
        return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")
      }

      const result = await updatePart(parsed.data)
      revalidatePartPaths(result.partId)
      return { success: true, message: "Part updated.", partId: result.partId }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setPartActiveAction(input: unknown): Promise<PartMutationResult> {
  try {
    const principal = await requireUser()
    const parsed = setPartActiveSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")
    }

    return runAuthorizedPartOperation(
      principal,
      getPartStatusOperation(parsed.data.isActive),
      async () => {
        const result = await setPartActive(parsed.data)
        revalidatePartPaths(result.partId)
        return {
          success: true,
          message: parsed.data.isActive ? "Part reactivated." : "Part deactivated.",
          partId: result.partId,
        }
      }
    )
  } catch (error) {
    return mutationFailure(error)
  }
}
