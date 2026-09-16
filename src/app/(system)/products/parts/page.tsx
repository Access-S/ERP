// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { PartsTable } from "@/features/parts/components/parts-table"
import { getPartFilterOptions, getPartStats } from "@/features/parts/services/part-service"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPartPermission } from "@/features/parts/services/part-authorization"

export const dynamic = "force-dynamic"

// ───────────────── BLOCK 2: Page ─────────────────────────────────────────────
export default async function PartsPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPartPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view the Parts Library."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const [stats, filterOptions] = await Promise.all([
    getPartStats(),
    getPartFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products/boms">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All BOMs
            </Link>
          </Button>
          <h1 className="sr-only">Parts Library</h1>
        </div>
        {hasPartPermission(principal, "create") && (
          <Button asChild>
            <Link href="/products/parts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Part
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Parts</CardDescription>
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
            <CardDescription>Used in Active BOMs</CardDescription>
            <CardTitle className="text-3xl">{stats.used}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Not in Active BOMs</CardDescription>
            <CardTitle className={stats.unused > 0 ? "text-3xl text-destructive" : "text-3xl"}>
              {stats.unused}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading Parts table">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <PartsTable partTypeOptions={filterOptions.partTypes} />
      </Suspense>
    </div>
  )
}
