// ───────────────── BLOCK 1: Imports & Component ────────────────
import { getCustomerActiveSkus, getProductStats } from "@/features/products/services/product-service"
import { getBomStats } from "@/features/boms/services/bom-service"
import { CustomerSkuList } from "@/features/products/components/customer-sku-list"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { PackageSearch, Building2, ArrowUpRight, Plus, AlertTriangle, Library, CheckCircle2, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const [productStats, customers, bomStats] = await Promise.all([
    getProductStats(),
    getCustomerActiveSkus(),
    getBomStats(),
  ])
  
  const healthDenominator = Math.max(1, productStats.active)
  const completePct = (bomStats.complete / healthDenominator) * 100
  const attentionPct = (bomStats.attention / healthDenominator) * 100
  const missingPct = (productStats.missingActiveBom / healthDenominator) * 100

  return (
    <div className="flex flex-col gap-6 p-6">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & BOM</h1>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Top KPI Row (4 blocks) - compact, spans same width as BOM Health below */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Products</CardDescription>
                <CardTitle className="text-3xl">{productStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active</CardDescription>
                <CardTitle className="text-3xl">{productStats.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Has BOM</CardDescription>
                <CardTitle className="text-3xl">{productStats.withActiveBom}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>BOM Attention</CardDescription>
                <CardTitle className={bomStats.attention > 0 ? "text-3xl text-destructive" : "text-3xl"}>
                  {bomStats.attention}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          
          {/* BOM Health & Progress Bar */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>BOM Health Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex w-full h-4 rounded-full overflow-hidden bg-muted">
                <div className="bg-primary" style={{ width: `${completePct}%` }} />
                <div className="bg-destructive" style={{ width: `${attentionPct}%` }} />
                <div className="bg-muted-foreground" style={{ width: `${missingPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Complete
                  </span>
                  <span className="font-bold text-lg ml-4">{bomStats.complete}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Attention
                  </span>
                  <span className="font-bold text-lg ml-4">{bomStats.attention}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Missing
                  </span>
                  <span className="font-bold text-lg ml-4">{productStats.missingActiveBom}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Required List */}
          <Card>
            <CardHeader>
              <CardTitle>Action Required</CardTitle>
              <CardDescription>Products that need immediate attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bomStats.attention > 0 && (
                <div className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">{bomStats.attention} BOMs need attention</p>
                      <p className="text-xs text-muted-foreground">Review invalid quantities or duplicate component lines.</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/products/boms">Review</Link>
                  </Button>
                </div>
              )}
              {productStats.missingActiveBom > 0 && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{productStats.missingActiveBom} Products are missing an active BOM</p>
                      <p className="text-xs text-muted-foreground">Create a BOM before using these Products in planning.</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      href={{
                        pathname: "/products/catalog",
                        query: {
                          filters: JSON.stringify([
                            { id: "bom_state", operator: "contains", value: ["MISSING"] },
                          ]),
                        },
                      }}
                    >
                      Review
                    </Link>
                  </Button>
                </div>
              )}
              {bomStats.attention === 0 && productStats.missingActiveBom === 0 && (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">No BOM actions required</p>
                    <p className="text-xs text-muted-foreground">All active Products have complete BOMs.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          
          {/* Quick Actions Section - SHRUNK DOWN */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href="/products/catalog" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <Boxes className="h-4 w-4 mr-1" />
                All Products
              </Link>
              <Link href="/products/customers" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <Building2 className="h-4 w-4 mr-1" />
                All Customers
              </Link>
              <Link href="/products/boms" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <PackageSearch className="h-4 w-4 mr-1" />
                All BOMs
              </Link>
              <Link href="/products/parts" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <Library className="h-4 w-4 mr-1" />
                Parts Library
              </Link>
              <Button variant="outline" className="h-10" disabled>
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Import/Export
              </Button>
              <Button variant="outline" className="h-10" disabled>
                <Plus className="h-4 w-4 mr-1" />
                New Product
              </Button>
            </CardContent>
          </Card>

          {/* NEW: Customer SKU Overview List */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle>Customer Active SKUs</CardTitle>
              <CardDescription>Sorted by highest product count.</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomerSkuList customers={customers} />
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  )
}
