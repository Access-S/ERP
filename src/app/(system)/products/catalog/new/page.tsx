// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductForm } from "@/features/products/components/product-form"
import { getProductCustomerOptions } from "@/features/products/services/product-service"

export const dynamic = "force-dynamic"

// ---------------- BLOCK 2: Page ----------------
export default async function NewProductPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Create Product</h1>
        <p className="text-sm text-muted-foreground">
          Add a finished good and begin its first draft BOM.
        </p>
      </div>
      <div className="max-w-5xl">
        <ProductForm mode="create" customerOptions={customerOptions} />
      </div>
    </div>
  )
}
