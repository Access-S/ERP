"use server"

import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import {
  createProduct,
  getProductsPage,
  ProductWorkflowError,
  setProductActive,
  updateProduct,
} from "../services/product-service"
import {
  createProductInputSchema,
  setProductActiveSchema,
  updateProductInputSchema,
  type ProductListItem,
  type ProductMutationResult,
} from "../types/product-schema"

async function isAuthenticated(): Promise<boolean> {
  const session = await auth()
  return Boolean(session?.user)
}

function failure(message: string): ProductMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): ProductMutationResult {
  if (error instanceof ProductWorkflowError) return failure(error.message)
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return failure("Another update happened at the same time. Please try again.")
  }
  console.error("Product mutation failed", error)
  return failure("The Product could not be updated. Please try again.")
}

function revalidateProductPaths(productId: string, bomId?: string) {
  revalidatePath("/products")
  revalidatePath("/products/catalog")
  revalidatePath(`/products/catalog/${productId}`)
  revalidatePath(`/products/catalog/${productId}/edit`)
  revalidatePath("/products/boms")
  revalidatePath("/purchase-orders")
  if (bomId) revalidatePath(`/products/boms/${bomId}`)
}

export async function fetchProductsPage(
  params: DataTableRequest
): Promise<DataTableResponseData<ProductListItem>> {
  const validated = dataTableRequestSchema.parse(params)
  return getProductsPage(validated)
}

export async function createProductAction(input: unknown): Promise<ProductMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to create Products.")
  const parsed = createProductInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")

  try {
    const result = await createProduct(parsed.data)
    revalidateProductPaths(result.productId, result.bomId)
    return {
      success: true,
      message: "Product created with an editable draft BOM.",
      productId: result.productId,
      bomId: result.bomId,
    }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateProductAction(input: unknown): Promise<ProductMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to edit Products.")
  const parsed = updateProductInputSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")

  try {
    const result = await updateProduct(parsed.data)
    revalidateProductPaths(result.productId)
    return { success: true, message: "Product updated.", productId: result.productId }
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setProductActiveAction(input: unknown): Promise<ProductMutationResult> {
  if (!(await isAuthenticated())) return failure("You must sign in to change Product status.")
  const parsed = setProductActiveSchema.safeParse(input)
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")

  try {
    const result = await setProductActive(parsed.data)
    revalidateProductPaths(result.productId)
    const archiveNote = result.archivedBomCount > 0
      ? ` ${result.archivedBomCount} operational BOM ${result.archivedBomCount === 1 ? "revision was" : "revisions were"} archived.`
      : ""
    return {
      success: true,
      message: parsed.data.isActive
        ? "Product reactivated. Create and activate a BOM when it is ready for production."
        : `Product deactivated.${archiveNote}`,
      productId: result.productId,
    }
  } catch (error) {
    return mutationFailure(error)
  }
}
