import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { StandardCustomerOrderForm } from "@/features/customer-orders/components/standard-customer-order-form"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import { getCustomerOrderCreateOptions } from "@/features/customer-orders/services/customer-order-service"

export const dynamic = "force-dynamic"

export default async function NewStandardCustomerOrderPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerOrderPermission(principal, "create")) {
    return (
      <PermissionDenied
        description="You need permission to create Customer Orders."
        backHref="/customer-orders"
        backLabel="Return to Customer Orders"
      />
    )
  }
  const options = await getCustomerOrderCreateOptions()
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customer-orders/new"><ArrowLeft className="mr-2 h-4 w-4" />Choose PO type</Link>
        </Button>
        <div>
          <h1 className="sr-only">New Standard Customer PO</h1>
        </div>
      </div>
      <StandardCustomerOrderForm options={options} today={today} />
    </div>
  )
}
