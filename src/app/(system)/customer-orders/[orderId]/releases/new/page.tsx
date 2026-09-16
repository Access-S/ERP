import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { StandardCustomerOrderForm } from "@/features/customer-orders/components/standard-customer-order-form"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import {
  getCustomerOrderById,
  getCustomerOrderCreateOptions,
} from "@/features/customer-orders/services/customer-order-service"

export const dynamic = "force-dynamic"

export default async function NewBlanketReleasePage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerOrderPermission(principal, "createRelease")) {
    return (
      <PermissionDenied
        description="You need permission to create Customer Order releases."
        backHref="/customer-orders"
        backLabel="Return to Customer Orders"
      />
    )
  }
  const { orderId } = await params
  const [order, options] = await Promise.all([
    getCustomerOrderById(orderId),
    getCustomerOrderCreateOptions(),
  ])
  if (!order || order.type !== "BLANKET") notFound()
  if (["CANCELLED", "CLOSED", "EXPIRED"].includes(order.status)) {
    return (
      <PermissionDenied
        description="This Blanket PO cannot accept new releases."
        backHref={`/customer-orders/${order.id}`}
        backLabel="Return to Blanket PO"
      />
    )
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/customer-orders/${order.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />{order.internalOrderNumber}
          </Link>
        </Button>
        <div>
          <h1 className="sr-only">New Blanket release</h1>
        </div>
      </div>
      <StandardCustomerOrderForm
        workflow="BLANKET_RELEASE"
        parentOrderId={order.id}
        fixedCustomerId={order.customerId}
        options={options}
        today={today}
      />
    </div>
  )
}
