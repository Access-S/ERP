// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductForm } from "@/features/products/components/product-form"
import {
  getProductById,
  getProductCustomerOptions,
} from "@/features/products/services/product-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasProductPermission } from "@/features/products/services/product-authorization"

export const dynamic = "force-dynamic"

// ---------------- BLOCK 2: Helpers ----------------
function formNumber(value: number | null): string {
  return value === null ? "" : String(value)
}

// ---------------- BLOCK 3: Page ----------------
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const principal = await getCurrentPrincipal()
  const canView = principal ? hasProductPermission(principal, "view") : false
  const canEditMaster = principal
    ? hasProductPermission(principal, "editMaster")
    : false
  const canEditCommercial = principal
    ? hasProductPermission(principal, "editCommercial")
    : false

  if (!principal || !canView || (!canEditMaster && !canEditCommercial)) {
    return (
      <PermissionDenied
        description="You need permission to edit Product master or commercial data."
        backHref="/products/catalog"
        backLabel="Return to Product Catalog"
      />
    )
  }

  const { productId } = await params
  const product = await getProductById(productId)
  if (!product) notFound()
  const customerOptions = canEditMaster
    ? await getProductCustomerOptions()
    : product.customer_id
      ? [{
          id: product.customer_id,
          code: product.customer_code ?? "Assigned Customer",
          name: product.customer_name ?? "Current assignment",
          isActive: true,
        }]
      : []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/products/catalog/${product.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {product.product_code}
          </Link>
        </Button>
        <h1 className="sr-only">Edit Product</h1>
      </div>
      <div className="max-w-5xl">
        <ProductForm
          mode="edit"
          productId={product.id}
          customerOptions={customerOptions}
          canEditMaster={canEditMaster}
          canEditCommercial={canEditCommercial}
          initialValues={{
            productCode: product.product_code,
            description: product.description ?? "",
            customerId: product.customer_id ?? "",
            unitsPerShipper: formNumber(product.units_per_shipper),
            uom: product.uom,
            category: product.category ?? "",
            dailyRunRate: formNumber(product.daily_run_rate),
            hourlyRunRate: formNumber(product.hourly_run_rate),
            minsPerShipper: formNumber(product.mins_per_shipper),
            pricePerShipper: formNumber(product.price_per_shipper),
          }}
        />
      </div>
    </div>
  )
}
