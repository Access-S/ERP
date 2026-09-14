import type { Prisma } from "@prisma/client"
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Pencil } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import { getCustomerOrderById } from "@/features/customer-orders/services/customer-order-service"
import { CustomerOrderCancelAction } from "@/features/customer-orders/components/customer-order-cancel-action"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function label(value: string): string {
  return value.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ")
}

function issues(value: Prisma.JsonValue): { code: string; message: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const code = "code" in item && typeof item.code === "string" ? item.code : null
    const message = "message" in item && typeof item.message === "string" ? item.message : null
    return code && message ? [{ code, message }] : []
  })
}

function money(currency: string, value: Prisma.Decimal | null): string {
  return value === null ? "—" : `${currency} ${value.toFixed(2)}`
}

export default async function CustomerOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
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

  const { orderId } = await params
  const order = await getCustomerOrderById(orderId)
  if (!order) notFound()
  const editableRelease = order.type === "STANDARD" && order.releases.length === 1
    ? order.releases[0]
    : null
  const canEdit =
    editableRelease &&
    ["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(editableRelease.status) &&
    hasCustomerOrderPermission(principal, "edit") &&
    hasCustomerOrderPermission(principal, "editRelease")
  const canCancel =
    editableRelease &&
    ["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(editableRelease.status) &&
    hasCustomerOrderPermission(principal, "cancel")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/customer-orders"><ArrowLeft className="mr-2 h-4 w-4" />Customer Orders</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{order.internalOrderNumber}</h1>
            <Badge variant={order.status === "PO_CHECK" ? "destructive" : "default"}>
              {label(order.status)}
            </Badge>
            <Badge variant="outline">{label(order.type)}</Badge>
          </div>
          <p className="text-muted-foreground">
            Customer PO {order.customerPoNumber} · {order.customer.trading_name ?? order.customer.legal_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild>
              <Link href={`/customer-orders/${order.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />Correct Customer PO
              </Link>
            </Button>
          )}
          {canCancel && editableRelease && (
            <CustomerOrderCancelAction
              orderId={order.id}
              releaseId={editableRelease.id}
              customerPoNumber={order.customerPoNumber}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardDescription>Customer</CardDescription><CardTitle className="text-lg">{order.customer.customer_code}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Received</CardDescription><CardTitle className="text-lg">{dateFormatter.format(order.receivedDate)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Currency</CardDescription><CardTitle className="text-lg">{order.currency}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Releases</CardDescription><CardTitle className="text-2xl">{order.releases.length}</CardTitle></CardHeader></Card>
      </div>

      {order.releases.map((release) => {
        const releaseIssues = issues(release.validationIssues)
        return (
          <Card key={release.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {release.internalReleaseNumber}
                    <Badge variant={release.status === "PO_CHECK" ? "destructive" : "default"}>
                      {label(release.status)}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Customer release: {release.customerReleaseReference ?? "Not supplied"} · Revision {release.revisionNumber}
                  </CardDescription>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Expected net total</p>
                  <p className="text-xl font-semibold tabular-nums">{money(order.currency, release.expectedNetTotal)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {release.status === "PO_CHECK" ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>PO Check — not available for planning</AlertTitle>
                  <AlertDescription>
                    {releaseIssues.length > 0
                      ? releaseIssues.map((issue) => issue.message).join(" · ")
                      : "One or more lines require Customer Service correction."}
                  </AlertDescription>
                </Alert>
              ) : release.status === "READY_FOR_PLANNING" ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready for Planning</AlertTitle>
                  <AlertDescription>
                    Quantity, price, line total, complete PO total, and active BOM checks passed.
                  </AlertDescription>
                </Alert>
              ) : release.status === "CANCELLED" ? (
                <Alert>
                  <Ban className="h-4 w-4" />
                  <AlertTitle>Customer PO cancelled</AlertTitle>
                  <AlertDescription>
                    This release is retained for history and is not available for planning or correction.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>{label(release.status)}</AlertTitle>
                  <AlertDescription>
                    This release has moved beyond Customer Service correction into its operational workflow.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-muted-foreground">Customer total</p><p className="font-medium tabular-nums">{money(order.currency, release.customerNetTotal)}</p></div>
                <div><p className="text-muted-foreground">Expected total</p><p className="font-medium tabular-nums">{money(order.currency, release.expectedNetTotal)}</p></div>
                <div><p className="text-muted-foreground">Variance</p><p className="font-medium tabular-nums">{money(order.currency, release.varianceAmount)}</p></div>
                <div><p className="text-muted-foreground">Tolerance snapshot</p><p className="font-medium">{release.tolerancePercentageSnapshot?.toFixed(4) ?? "—"}%</p></div>
                <div><p className="text-muted-foreground">Default delivery</p><p className="font-medium">{release.defaultRequestedDeliveryDate ? dateFormatter.format(release.defaultRequestedDeliveryDate) : "Per line"}</p></div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Line</TableHead><TableHead>Product</TableHead><TableHead>Ordered</TableHead>
                      <TableHead>Shippers</TableHead><TableHead>Price / shipper</TableHead>
                      <TableHead>Customer value</TableHead><TableHead>Expected value</TableHead>
                      <TableHead>Delivery</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {release.lines.map((line) => {
                      const lineIssues = issues(line.validationIssues)
                      return (
                        <TableRow key={line.id}>
                          <TableCell>{line.position}</TableCell>
                          <TableCell>
                            <div className="font-medium">{line.productCodeSnapshot}</div>
                            <div className="max-w-56 truncate text-xs text-muted-foreground" title={line.productDescriptionSnapshot ?? undefined}>{line.productDescriptionSnapshot ?? "—"}</div>
                          </TableCell>
                          <TableCell className="tabular-nums">{line.orderedQuantity.toFixed()} {label(line.orderUom)}</TableCell>
                          <TableCell className="tabular-nums">{line.calculatedShippers?.toFixed() ?? "—"}</TableCell>
                          <TableCell className="tabular-nums">{money(order.currency, line.pricePerShipperSnapshot)}</TableCell>
                          <TableCell className="tabular-nums">{money(order.currency, line.customerLineValue)}</TableCell>
                          <TableCell className="tabular-nums">{money(order.currency, line.expectedLineValue)}</TableCell>
                          <TableCell>{line.requestedDeliveryDate ? dateFormatter.format(line.requestedDeliveryDate) : "Missing"}</TableCell>
                          <TableCell>
                            <Badge variant={line.validationStatus === "VALID" ? "secondary" : "destructive"} title={lineIssues.map((issue) => issue.message).join(" · ")}>
                              {label(line.validationStatus)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Revision history</h3>
                <div className="mt-2 space-y-2">
                  {release.revisions.map((revision) => (
                    <div key={revision.id} className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                      <span>Revision {revision.revision} · {revision.changeReason ?? "Customer Order update"}</span>
                      <span className="text-muted-foreground">{dateFormatter.format(revision.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
