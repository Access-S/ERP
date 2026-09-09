import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft, PackagePlus, ScrollText } from "lucide-react"
import { ProductsTable } from "@/features/products/components/products-table"
import { getProductStats } from "@/features/products/services/product-service"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const dynamic = "force-dynamic"

export default async function ProductCatalogPage() {
  const stats = await getProductStats()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Products &amp; BOM
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Finished goods and customer SKUs, with their active BOM configuration.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/products/boms">
              <ScrollText className="mr-2 h-4 w-4" />
              All BOMs
            </Link>
          </Button>
          <Button asChild>
            <Link href="/products/catalog/new">
              <PackagePlus className="mr-2 h-4 w-4" />
              New Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Active BOM</CardDescription>
            <CardTitle className="text-3xl">{stats.withActiveBom}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing Active BOM</CardDescription>
            <CardTitle className={stats.missingActiveBom > 0 ? "text-3xl text-destructive" : "text-3xl"}>
              {stats.missingActiveBom}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-3xl">{stats.inactive}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading Product table">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <ProductsTable />
      </Suspense>
    </div>
  )
}
