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
  const { productId } = await params
  const [product, customerOptions] = await Promise.all([
    getProductById(productId),
    getProductCustomerOptions(),
  ])
  if (!product) notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/products/catalog/${product.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {product.product_code}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
        <p className="text-sm text-muted-foreground">
          Update the master data for {product.product_code}.
        </p>
      </div>
      <div className="max-w-5xl">
        <ProductForm
          mode="edit"
          productId={product.id}
          customerOptions={customerOptions}
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
