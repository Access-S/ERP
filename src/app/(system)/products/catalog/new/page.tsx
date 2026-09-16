// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductForm } from "@/features/products/components/product-form"
import { getProductCustomerOptions } from "@/features/products/services/product-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasProductPermission } from "@/features/products/services/product-authorization"

export const dynamic = "force-dynamic"

// ---------------- BLOCK 2: Page ----------------
export default async function NewProductPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasProductPermission(principal, "create")) {
    return (
      <PermissionDenied
        description="You need permission to create Products and draft BOMs."
        backHref="/products/catalog"
        backLabel="Return to Product Catalog"
      />
    )
  }

  const customerOptions = await getProductCustomerOptions()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/catalog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Product Catalog
          </Link>
        </Button>
        <h1 className="sr-only">Create Product</h1>
      </div>
      <div className="max-w-5xl">
        <ProductForm
          mode="create"
          customerOptions={customerOptions}
          canEditCommercial={hasProductPermission(principal, "editCommercial")}
        />
      </div>
    </div>
  )
}
