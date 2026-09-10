// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import Link from "next/link"
import { Suspense } from "react"
import { Boxes, Library, PackageSearch } from "lucide-react"
import { BomsTable } from "@/features/boms/components/boms-table"
import { getBomStats } from "@/features/boms/services/bom-service"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { hasBomPermission } from "@/features/boms/services/bom-authorization"

export const dynamic = "force-dynamic"

// ───────────────── BLOCK 2: Page ─────────────────────────────────────────────
export default async function BomsPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasBomPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view BOM revisions and components."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const stats = await getBomStats()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All BOMs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One record per Product BOM. Open a BOM to inspect its component lines and health issues.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(principal, "product.view") && (
            <Button variant="outline" asChild>
              <Link href="/products/catalog">
                <Boxes className="mr-2 h-4 w-4" />
                Product Catalog
              </Link>
            </Button>
          )}
          {hasPermission(principal, "part.view") && (
            <Button variant="outline" asChild>
              <Link href="/products/parts">
                <Library className="mr-2 h-4 w-4" />
                Parts Library
              </Link>
            </Button>
          )}
          {hasBomPermission(principal, "createDraft") && (
            <Button disabled>
              <PackageSearch className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total BOMs</CardDescription>
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
            <CardDescription>Active Complete</CardDescription>
            <CardTitle className="text-3xl">{stats.complete}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Needs Attention</CardDescription>
            <CardTitle className={stats.attention > 0 ? "text-3xl text-destructive" : "text-3xl"}>
              {stats.attention}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Products Missing BOM</CardDescription>
            <CardTitle className={stats.productsMissingBom > 0 ? "text-3xl text-destructive" : "text-3xl"}>
              {stats.productsMissingBom}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading BOM table">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <BomsTable />
      </Suspense>
    </div>
  )
}
