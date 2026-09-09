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

async function isAuthenticated(): Promise<boolean> {
  const session = await auth()
  return Boolean(session?.user)
}

function failure(message: string): PartMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): PartMutationResult {
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
  const validated = dataTableRequestSchema.parse(params)
  return getPartsPage(validated)
}

export async function createPartAction(input: unknown): Promise<PartMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to create Parts.")
  const parsed = createPartInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")

  try {
    const result = await createPart(parsed.data)
    revalidatePartPaths(result.partId)
    return { success: true, message: "Part created.", partId: result.partId }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updatePartAction(input: unknown): Promise<PartMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to edit Parts.")
  const parsed = updatePartInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")

  try {
    const result = await updatePart(parsed.data)
    revalidatePartPaths(result.partId)
    return { success: true, message: "Part updated.", partId: result.partId }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setPartActiveAction(input: unknown): Promise<PartMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to change Part status.")
  const parsed = setPartActiveSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Part.")

  try {
    const result = await setPartActive(parsed.data)
    revalidatePartPaths(result.partId)
    return {
      success: true,
      message: parsed.data.isActive ? "Part reactivated." : "Part deactivated.",
      partId: result.partId,
    }
  } catch (error) {
    return mutationFailure(error)
  }
}
