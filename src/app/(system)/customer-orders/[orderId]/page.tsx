import type { Prisma } from "@prisma/client"
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"
import { getCustomerOrderById } from "@/features/customer-orders/services/customer-order-service"
import { CustomerOrderCancelAction } from "@/features/customer-orders/components/customer-order-cancel-action"
import { CustomerOrderLinesTable } from "@/features/customer-orders/components/customer-order-lines-table"
import { BlanketTopUpAction } from "@/features/customer-orders/components/blanket-top-up-action"
import { getBlanketBalanceForDisplay } from "@/features/customer-orders/services/blanket-customer-order-service"

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
  const blanketBalance = order.type === "BLANKET"
    ? getBlanketBalanceForDisplay(order)
    : null
  const canCreateRelease =
    order.type === "BLANKET" &&
    !["CANCELLED", "CLOSED", "EXPIRED"].includes(order.status) &&
    hasCustomerOrderPermission(principal, "createRelease")
  const canAmendBlanket =
    order.type === "BLANKET" &&
    ["ACTIVE", "EXHAUSTED"].includes(order.status) &&
    hasCustomerOrderPermission(principal, "amendBlanket")
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/customer-orders"><ArrowLeft className="mr-2 h-4 w-4" />Customer Orders</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="sr-only">{order.internalOrderNumber}</h1>
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
          {canAmendBlanket && (
            <BlanketTopUpAction
              orderId={order.id}
              customerPoNumber={order.customerPoNumber}
              today={today}
            />
          )}
          {canCreateRelease && (
            <Button asChild>
              <Link href={`/customer-orders/${order.id}/releases/new`}>
                <Plus className="mr-2 h-4 w-4" />New release
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardDescription>Customer</CardDescription><CardTitle className="text-lg">{order.customer.customer_code}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Received</CardDescription><CardTitle className="text-lg">{dateFormatter.format(order.receivedDate)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Currency</CardDescription><CardTitle className="text-lg">{order.currency}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Releases</CardDescription><CardTitle className="text-2xl">{order.releases.length}</CardTitle></CardHeader></Card>
      </div>

      {blanketBalance && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><CardDescription>Original authority</CardDescription><CardTitle className="text-xl tabular-nums">{money(order.currency, blanketBalance.originalAuthorizedValue)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Top-ups</CardDescription><CardTitle className="text-xl tabular-nums">{money(order.currency, blanketBalance.amendmentValue)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Committed releases</CardDescription><CardTitle className="text-xl tabular-nums">{money(order.currency, blanketBalance.committedValue)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Available value</CardDescription><CardTitle className="text-xl tabular-nums">{money(order.currency, blanketBalance.availableValue)}</CardTitle></CardHeader></Card>
        </div>
      )}

      {order.type === "BLANKET" && (
        <Card>
          <CardHeader>
            <CardTitle>Blanket authority and amendments</CardTitle>
            <CardDescription>
              Valid {order.validFrom ? dateFormatter.format(order.validFrom) : "—"} to {order.validTo ? dateFormatter.format(order.validTo) : "—"}. Original authority is never overwritten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {order.amendments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No top-ups recorded.</p>
            ) : (
              <div className="space-y-2">
                {order.amendments.map((amendment) => (
                  <div key={amendment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div>
                        <span className="font-medium">+{money(order.currency, amendment.valueDelta)}</span>
                        <span className="text-muted-foreground"> · {amendment.customerReference ?? "No customer reference"}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {amendment.reason ?? "No reason recorded"}
                      </div>
                    </div>
                    <div className="text-right text-muted-foreground">
                      <div>{dateFormatter.format(amendment.effectiveDate)}</div>
                      <div>Authority: {money(order.currency, amendment.resultingAuthorizedValue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.type === "BLANKET" && order.releases.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No releases yet. The Blanket PO itself does not create production demand.
          </CardContent>
        </Card>
      )}

      {order.releases.map((release) => {
        const releaseIssues = issues(release.validationIssues)
        const canEditBlanketRelease =
          order.type === "BLANKET" &&
          ["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(release.status) &&
          hasCustomerOrderPermission(principal, "editRelease")
        const canCancelBlanketRelease =
          order.type === "BLANKET" &&
          ["DRAFT", "PO_CHECK", "READY_FOR_PLANNING"].includes(release.status) &&
          hasCustomerOrderPermission(principal, "cancel")
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
                <div className="flex flex-wrap items-start gap-2">
                  <div className="mr-2 text-right text-sm">
                    <p className="text-muted-foreground">Expected net total</p>
                    <p className="text-xl font-semibold tabular-nums">{money(order.currency, release.expectedNetTotal)}</p>
                  </div>
                  {canEditBlanketRelease && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/customer-orders/${order.id}/releases/${release.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />Correct release
                      </Link>
                    </Button>
                  )}
                  {canCancelBlanketRelease && (
                    <CustomerOrderCancelAction
                      mode="BLANKET_RELEASE"
                      orderId={order.id}
                      releaseId={release.id}
                      customerPoNumber={order.customerPoNumber}
                    />
                  )}
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

              <CustomerOrderLinesTable
                currency={order.currency}
                lines={release.lines.map((line) => ({
                  id: line.id,
                  position: line.position,
                  productCode: line.productCodeSnapshot,
                  productDescription: line.productDescriptionSnapshot,
                  orderedQuantity: line.orderedQuantity.toFixed(),
                  orderUom: line.orderUom,
                  calculatedShippers: line.calculatedShippers?.toFixed() ?? null,
                  pricePerShipper: line.pricePerShipperSnapshot?.toFixed(2) ?? null,
                  customerValue: line.customerLineValue.toFixed(2),
                  expectedValue: line.expectedLineValue?.toFixed(2) ?? null,
                  requestedDeliveryDate: line.requestedDeliveryDate?.toISOString() ?? null,
                  validationStatus: line.validationStatus,
                  validationIssueText: issues(line.validationIssues)
                    .map((issue) => issue.message)
                    .join(" · "),
                }))}
              />

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
