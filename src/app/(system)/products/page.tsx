// ───────────────── BLOCK 1: Imports & Component ────────────────
import { getProducts, getCustomerActiveSkus } from "@/features/products/services/product-service"
import { CustomerSkuList } from "@/features/products/components/customer-sku-list"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { PackageSearch, Building2, ArrowUpRight, Plus, AlertTriangle, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export default async function ProductsPage() {
  const products = await getProducts()
  const customers = await getCustomerActiveSkus()
  
  const totalProducts = products.length
  const activeProducts = products.filter(p => p.is_active).length
  
  // MOCK BOM DATA
  const mockTotalBoms = 1190
  const mockCompleteBoms = 1102
  const mockIncompleteBoms = 51
  const mockMissingBoms = 37

  const completePct = (mockCompleteBoms / mockTotalBoms) * 100
  const incompletePct = (mockIncompleteBoms / mockTotalBoms) * 100
  const missingPct = (mockMissingBoms / mockTotalBoms) * 100

  return (
    <div className="flex flex-col gap-6 p-6">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & BOM</h1>
          <p className="text-muted-foreground">
            Monitor product health, manage Bill of Materials, and resolve exceptions.
          </p>
        </div>
        <Link href="/products/list" className={cn(buttonVariants())}>
          <PackageSearch className="mr-2 h-4 w-4" />
          View List
        </Link>
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
                <CardTitle className="text-3xl">{totalProducts}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active</CardDescription>
                <CardTitle className="text-3xl">{activeProducts}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Has BOM</CardDescription>
                <CardTitle className="text-3xl">{mockCompleteBoms}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>BOM Attention</CardDescription>
                <CardTitle className="text-3xl text-destructive">{mockMissingBoms}</CardTitle>
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
                <div className="bg-emerald-500" style={{ width: `${completePct}%` }} />
                <div className="bg-amber-500" style={{ width: `${incompletePct}%` }} />
                <div className="bg-rose-500" style={{ width: `${missingPct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Complete
                  </span>
                  <span className="font-bold text-lg ml-4">{mockCompleteBoms}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Incomplete
                  </span>
                  <span className="font-bold text-lg ml-4">{mockIncompleteBoms}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Missing
                  </span>
                  <span className="font-bold text-lg ml-4">{mockMissingBoms}</span>
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
              <div className="flex items-center justify-between p-3 border rounded-md bg-rose-500/5 border-rose-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  <div>
                    <p className="font-medium">SKU 79646376</p>
                    <p className="text-xs text-muted-foreground">Missing Bill of Materials</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10">
                  Resolve
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md bg-amber-500/5 border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">BOX-100-B</p>
                    <p className="text-xs text-muted-foreground">BOM missing component quantities</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                  Resolve
                </Button>
              </div>
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
              <Link href="/customers" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <Building2 className="h-4 w-4 mr-1" />
                All Customers
              </Link>
              <Link href="/parts/list" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                <PackageSearch className="h-4 w-4 mr-1" />
                All Parts
              </Link>
              <Button variant="outline" className="h-10">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Import/Export
              </Button>
              <Button variant="outline" className="h-10">
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