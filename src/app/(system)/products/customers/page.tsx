// ───────────────── BLOCK 1: Imports & Component ────────────────
import { getCustomerStats } from "@/features/customers/services/customer-service"
import Link from "next/link"
import { Suspense } from "react"
import { CustomersTable } from "@/features/customers/components/customers-table"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerPermission } from "@/features/customers/services/customer-authorization"

export const dynamic = "force-dynamic"

// Summary numbers render once on the server — no cents on headline KPIs.
const exposureFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})

// ───────────────── BLOCK 2: Page ───────────────────────────────
export default async function CustomersPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view Customer records."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const stats = await getCustomerStats()

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        </div>
        {hasCustomerPermission(principal, "create") && (
          <Button asChild>
            <Link href="/products/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Customer
            </Link>
          </Button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Customers</CardDescription>
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
            <CardDescription>Credit Exposure</CardDescription>
            <CardTitle className="text-3xl">
              {exposureFormatter.format(stats.creditExposure)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Customer List */}
      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading customer table">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <CustomersTable />
      </Suspense>

    </div>
  )
}


