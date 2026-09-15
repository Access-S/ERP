import Link from "next/link"
import { Plus } from "lucide-react"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { CustomerOrdersTable } from "@/features/customer-orders/components/customer-orders-table"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import { getCustomerOrderStats } from "@/features/customer-orders/services/customer-order-service"

export const dynamic = "force-dynamic"

export default async function CustomerOrdersPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerOrderPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view Customer Orders."
        backHref="/"
        backLabel="Return to dashboard"
      />
    )
  }

  const stats = await getCustomerOrderStats()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer POs and releases received for production.
          </p>
        </div>
        {hasCustomerOrderPermission(principal, "create") && (
          <Button asChild>
            <Link href="/customer-orders/new">
              <Plus className="mr-2 h-4 w-4" />
              New Customer PO
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardDescription>Total Customer POs</CardDescription><CardTitle className="text-3xl">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>PO Check</CardDescription><CardTitle className="text-3xl">{stats.poCheck}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Ready for Planning</CardDescription><CardTitle className="text-3xl">{stats.readyForPlanning}</CardTitle></CardHeader></Card>
      </div>

      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading Customer Order table">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-14 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <CustomerOrdersTable />
      </Suspense>
    </div>
  )
}
