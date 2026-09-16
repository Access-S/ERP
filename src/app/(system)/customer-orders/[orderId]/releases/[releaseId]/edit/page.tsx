import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import {
  StandardCustomerOrderForm,
  type StandardCustomerOrderFormValues,
} from "@/features/customer-orders/components/standard-customer-order-form"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import {
  getCustomerOrderById,
  getCustomerOrderCreateOptions,
} from "@/features/customer-orders/services/customer-order-service"

export const dynamic = "force-dynamic"

function dateInput(value: Date | null): string {
  return value?.toISOString().slice(0, 10) ?? ""
}

export default async function EditBlanketReleasePage({
  params,
}: {
  params: Promise<{ orderId: string; releaseId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerOrderPermission(principal, "editRelease")) {
    return (
      <PermissionDenied
        description="You need permission to correct Customer Order releases."
        backHref="/customer-orders"
        backLabel="Return to Customer Orders"
      />
    )
  }
  const { orderId, releaseId } = await params
  const [order, options] = await Promise.all([
    getCustomerOrderById(orderId),
    getCustomerOrderCreateOptions(),
  ])
  if (!order || order.type !== "BLANKET") notFound()
  const release = order.releases.find((candidate) => candidate.id === releaseId)
  if (!release) notFound()
  if (!["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(release.status)) {
    return (
      <PermissionDenied
        description="This release has entered planning or production and cannot be corrected yet."
        backHref={`/customer-orders/${order.id}`}
        backLabel="Return to Blanket PO"
      />
    )
  }
  const initialValues: StandardCustomerOrderFormValues = {
    customerId: order.customerId,
    customerPoNumber: "",
    receivedDate: dateInput(release.receivedDate),
    customerReleaseReference: release.customerReleaseReference ?? "",
    defaultRequestedDeliveryDate: dateInput(release.defaultRequestedDeliveryDate),
    customerNetTotal: release.customerNetTotal?.toFixed(2) ?? "",
    lines: release.lines.map((line) => ({
      key: line.id,
      productId: line.productId,
      orderUom: line.orderUom,
      orderedQuantity: line.orderedQuantity.toFixed(),
      requestedDeliveryDate: dateInput(line.requestedDeliveryDate),
      customerLineValue: line.customerLineValue.toFixed(2),
    })),
  }
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/customer-orders/${order.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />{order.internalOrderNumber}
          </Link>
        </Button>
        <div>
          <h1 className="sr-only">Correct Blanket release</h1>
        </div>
      </div>
      <StandardCustomerOrderForm
        workflow="BLANKET_RELEASE"
        mode="edit"
        parentOrderId={order.id}
        releaseId={release.id}
        fixedCustomerId={order.customerId}
        options={options}
        today={dateInput(release.receivedDate)}
        initialValues={initialValues}
      />
    </div>
  )
}
