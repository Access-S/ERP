"use server"

import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/features/auth/services/authorization-service"
import { isAuthorizationError } from "@/features/auth/services/authorization-policy"
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
import {
  assertProductPermission,
  getProductStatusOperation,
  runAuthorizedProductOperation,
  runAuthorizedProductUpdate,
} from "../services/product-authorization"

function failure(message: string): ProductMutationResult {
  return { success: false, message }
}

function mutationFailure(error: unknown): ProductMutationResult {
  if (isAuthorizationError(error)) {
    return failure(
      error.status === 401
        ? "Your session is no longer valid. Please sign in again."
        : "You do not have permission to perform this Product action."
    )
  }
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
  const principal = await requireUser()
  return runAuthorizedProductOperation(principal, "view", () => {
    const validated = dataTableRequestSchema.parse(params)
    return getProductsPage(validated)
  })
}

export async function createProductAction(input: unknown): Promise<ProductMutationResult> {
  try {
    const principal = await requireUser()
    return runAuthorizedProductOperation(principal, "create", async () => {
      const parsed = createProductInputSchema.safeParse(input)
      if (!parsed.success) {
        return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")
      }
      if (parsed.data.pricePerShipper !== null) {
        assertProductPermission(principal, "editCommercial")
      }

      const result = await createProduct(parsed.data)
      revalidateProductPaths(result.productId, result.bomId)
      return {
        success: true,
        message: "Product created with an editable draft BOM.",
        productId: result.productId,
        bomId: result.bomId,
      }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function updateProductAction(input: unknown): Promise<ProductMutationResult> {
  try {
    const principal = await requireUser()
    assertProductPermission(principal, "view")
    const parsed = updateProductInputSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")
    }
    return runAuthorizedProductUpdate(principal, parsed.data, async () => {
      const result = await updateProduct(parsed.data)
      revalidateProductPaths(result.productId)
      return { success: true, message: "Product updated.", productId: result.productId }
    })
  } catch (error) {
    return mutationFailure(error)
  }
}

export async function setProductActiveAction(input: unknown): Promise<ProductMutationResult> {
  try {
    const principal = await requireUser()
    const parsed = setProductActiveSchema.safeParse(input)
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid Product.")
    }

    return runAuthorizedProductOperation(
      principal,
      getProductStatusOperation(parsed.data.isActive),
      async () => {
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
      }
    )
  } catch (error) {
    return mutationFailure(error)
  }
}
