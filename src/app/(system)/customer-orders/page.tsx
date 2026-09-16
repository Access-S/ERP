import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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
    <div className="flex min-w-0 max-w-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="sr-only">Customer Orders</h1>
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

      <CustomerOrdersTable stats={stats} />
    </div>
  )
}
