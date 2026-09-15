"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createBlanketReleaseAction,
  createStandardCustomerOrderAction,
  updateBlanketReleaseAction,
  updateStandardCustomerOrderAction,
} from "../actions/customer-order-actions"
import type { CustomerOrderCreateOptions } from "../services/customer-order-service"

type LineValues = {
  key: string
  productId: string
  orderUom: "UNIT" | "SHIPPER"
  orderedQuantity: string
  requestedDeliveryDate: string
  customerLineValue: string
}

export type StandardCustomerOrderFormValues = {
  customerId: string
  customerPoNumber: string
  receivedDate: string
  customerReleaseReference: string
  defaultRequestedDeliveryDate: string
  customerNetTotal: string
  lines: LineValues[]
}

function emptyLine(key = crypto.randomUUID()): LineValues {
  return {
    key,
    productId: "",
    orderUom: "UNIT",
    orderedQuantity: "",
    requestedDeliveryDate: "",
    customerLineValue: "",
  }
}

function linePreview(
  line: LineValues,
  product: CustomerOrderCreateOptions["customers"][number]["products"][number] | undefined,
  defaultRequestedDeliveryDate: string,
  tolerancePercentage: number
) {
  const quantity = Number(line.orderedQuantity)
  const unitsPerShipper = product?.unitsPerShipper ?? null
  const price = product?.pricePerShipper ? Number(product.pricePerShipper) : null
  const issues: string[] = []

  if (product && !product.activeBomId) issues.push("Active BOM missing")
  if (product && (!unitsPerShipper || unitsPerShipper <= 0)) issues.push("Units per shipper missing")
  if (product && (!price || price <= 0)) issues.push("Approved price missing")
  if (!line.requestedDeliveryDate && !defaultRequestedDeliveryDate) {
    issues.push("Delivery date missing")
  }
  if (line.orderedQuantity && (!Number.isInteger(quantity) || quantity <= 0)) {
    issues.push("Quantity must be a positive whole number")
  }

  let shippers: number | null = null
  if (Number.isInteger(quantity) && quantity > 0) {
    if (line.orderUom === "SHIPPER") shippers = quantity
    else if (unitsPerShipper && unitsPerShipper > 0) {
      shippers = quantity / unitsPerShipper
      if (!Number.isInteger(shippers)) issues.push("Units do not make complete shippers")
    }
  }
  const expectedValue = shippers !== null && price !== null
    ? Math.round((shippers * price + Number.EPSILON) * 100) / 100
    : null
  const customerLineValue = Number(line.customerLineValue)
  if (
    line.customerLineValue &&
    expectedValue !== null &&
    Number.isFinite(customerLineValue) &&
    Math.abs(customerLineValue - expectedValue) > expectedValue * tolerancePercentage / 100
  ) {
    issues.push(`Line value is outside the ${tolerancePercentage}% tolerance`)
  }
  return { shippers, expectedValue, issues }
}

export function StandardCustomerOrderForm({
  options,
  today,
  mode = "create",
  orderId,
  releaseId,
  initialValues,
  workflow = "STANDARD",
  parentOrderId,
  fixedCustomerId,
}: {
  options: CustomerOrderCreateOptions
  today: string
  mode?: "create" | "edit"
  orderId?: string
  releaseId?: string
  initialValues?: StandardCustomerOrderFormValues
  workflow?: "STANDARD" | "BLANKET_RELEASE"
  parentOrderId?: string
  fixedCustomerId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [customerId, setCustomerId] = React.useState(
    initialValues?.customerId ?? fixedCustomerId ?? ""
  )
  const [customerPoNumber, setCustomerPoNumber] = React.useState(initialValues?.customerPoNumber ?? "")
  const [receivedDate, setReceivedDate] = React.useState(initialValues?.receivedDate ?? today)
  const [customerReleaseReference, setCustomerReleaseReference] = React.useState(initialValues?.customerReleaseReference ?? "")
  const [defaultRequestedDeliveryDate, setDefaultRequestedDeliveryDate] = React.useState(initialValues?.defaultRequestedDeliveryDate ?? "")
  const [customerNetTotal, setCustomerNetTotal] = React.useState(initialValues?.customerNetTotal ?? "")
  const [lines, setLines] = React.useState<LineValues[]>(initialValues?.lines ?? [emptyLine("line-1")])

  const customer = options.customers.find((candidate) => candidate.id === customerId)
  const productById = React.useMemo(
    () => new Map((customer?.products ?? []).map((product) => [product.id, product])),
    [customer]
  )
  const previews = lines.map((line) => linePreview(
    line,
    productById.get(line.productId),
    defaultRequestedDeliveryDate,
    Number(options.tolerancePercentage)
  ))
  const expectedTotal = previews.every((preview) => preview.expectedValue !== null)
    ? previews.reduce((total, preview) => total + (preview.expectedValue ?? 0), 0)
    : null

  function updateLine(key: string, changes: Partial<LineValues>) {
    setLines((current) =>
      current.map((line) => line.key === key ? { ...line, ...changes } : line)
    )
  }

  function handleCustomerChange(value: string) {
    setCustomerId(value)
    setLines([emptyLine()])
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const releasePayload = {
        receivedDate,
        customerReleaseReference,
        defaultRequestedDeliveryDate,
        customerNetTotal,
        lines: lines.map((line) => ({
          productId: line.productId,
          orderUom: line.orderUom,
          orderedQuantity: line.orderedQuantity,
          requestedDeliveryDate: line.requestedDeliveryDate,
          customerLineValue: line.customerLineValue,
        })),
      }
      const result = workflow === "BLANKET_RELEASE" && parentOrderId
        ? mode === "edit" && releaseId
          ? await updateBlanketReleaseAction({ ...releasePayload, orderId: parentOrderId, releaseId })
          : await createBlanketReleaseAction({ ...releasePayload, orderId: parentOrderId })
        : mode === "edit" && orderId && releaseId
          ? await updateStandardCustomerOrderAction({
              ...releasePayload,
              customerId,
              customerPoNumber,
              orderId,
              releaseId,
            })
          : await createStandardCustomerOrderAction({
              ...releasePayload,
              customerId,
              customerPoNumber,
            })
      if (!result.success || !result.orderId) {
        toast.error(result.message)
        return
      }
      if (result.status === "PO_CHECK") toast.warning(result.message)
      else toast.success(result.message)
      router.push(`/customer-orders/${result.orderId}`)
      router.refresh()
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{workflow === "BLANKET_RELEASE" ? "Blanket release" : "Customer PO"}</CardTitle>
          <CardDescription>
            {workflow === "BLANKET_RELEASE"
              ? "Record this call-off against the existing Blanket PO. All values below exclude GST."
              : "Record the Customer document exactly as received. All values below exclude GST."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={customerId}
              onValueChange={handleCustomerChange}
              disabled={isPending || mode === "edit" || workflow === "BLANKET_RELEASE"}
            >
              <SelectTrigger id="customer" className="w-full">
                <SelectValue placeholder="Select a Customer" />
              </SelectTrigger>
              <SelectContent>
                {options.customers.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.code} - {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={customer?.currency ?? "Select Customer"} disabled />
          </div>
          {workflow === "STANDARD" && (
            <div className="space-y-2">
              <Label htmlFor="customer-po-number">Customer PO number</Label>
              <Input
                id="customer-po-number"
                value={customerPoNumber}
                onChange={(event) => setCustomerPoNumber(event.target.value)}
                maxLength={100}
                required
                disabled={isPending}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="received-date">Received date</Label>
            <Input
              id="received-date"
              type="date"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="release-reference">Customer release reference (optional)</Label>
            <Input
              id="release-reference"
              value={customerReleaseReference}
              onChange={(event) => setCustomerReleaseReference(event.target.value)}
              maxLength={100}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-delivery-date">Default requested delivery date</Label>
            <Input
              id="default-delivery-date"
              type="date"
              value={defaultRequestedDeliveryDate}
              onChange={(event) => setDefaultRequestedDeliveryDate(event.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-net-total">
              Customer {workflow === "BLANKET_RELEASE" ? "release" : "PO"} total (ex GST)
            </Label>
            <Input
              id="customer-net-total"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={customerNetTotal}
              onChange={(event) => setCustomerNetTotal(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Configured tolerance</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {options.tolerancePercentage}%
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Order lines</CardTitle>
            <CardDescription>
              Select a Customer SKU, enter the ordered UOM and the Customer-stated line value.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            disabled={isPending || lines.length >= 100}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {lines.map((line, index) => {
            const product = productById.get(line.productId)
            const preview = previews[index]
            return (
              <div key={line.key} className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-medium">Line {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    disabled={isPending || lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`product-${line.key}`}>Product / SKU</Label>
                    <Select
                      value={line.productId}
                      onValueChange={(value) => updateLine(line.key, { productId: value })}
                      disabled={isPending || !customer}
                    >
                      <SelectTrigger id={`product-${line.key}`} className="w-full">
                        <SelectValue placeholder={customer ? "Select a Product" : "Select Customer first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(customer?.products ?? []).map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.code} - {option.description ?? "No description"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`uom-${line.key}`}>Order UOM</Label>
                    <Select
                      value={line.orderUom}
                      onValueChange={(value: "UNIT" | "SHIPPER") => updateLine(line.key, { orderUom: value })}
                      disabled={isPending}
                    >
                      <SelectTrigger id={`uom-${line.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNIT">Units</SelectItem>
                        <SelectItem value="SHIPPER">Shippers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${line.key}`}>Quantity</Label>
                    <Input
                      id={`quantity-${line.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={line.orderedQuantity}
                      onChange={(event) => updateLine(line.key, { orderedQuantity: event.target.value })}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`line-value-${line.key}`}>Line value (ex GST)</Label>
                    <Input
                      id={`line-value-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.customerLineValue}
                      onChange={(event) => updateLine(line.key, { customerLineValue: event.target.value })}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`delivery-${line.key}`}>Delivery date</Label>
                    <Input
                      id={`delivery-${line.key}`}
                      type="date"
                      value={line.requestedDeliveryDate}
                      onChange={(event) => updateLine(line.key, { requestedDeliveryDate: event.target.value })}
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <div><span className="text-muted-foreground">Units/shipper:</span> {product?.unitsPerShipper ?? "Missing"}</div>
                  <div><span className="text-muted-foreground">Price/shipper:</span> {product?.pricePerShipper ?? "Missing"}</div>
                  <div><span className="text-muted-foreground">Calculated shippers:</span> {preview.shippers ?? "—"}</div>
                  <div><span className="text-muted-foreground">Expected value:</span> {preview.expectedValue === null ? "—" : preview.expectedValue.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">Active BOM:</span> {product?.activeBomRevision ? `Rev ${product.activeBomRevision}` : "Missing"}</div>
                </div>
                {preview.issues.length > 0 && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTitle>Line will require PO Check</AlertTitle>
                    <AlertDescription>{preview.issues.join(" · ")}</AlertDescription>
                  </Alert>
                )}
              </div>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
            <div>
              <p className="text-sm text-muted-foreground">System-expected total (preview)</p>
              <p className="text-xl font-semibold tabular-nums">
                {expectedTotal === null ? "Complete all Product data" : expectedTotal.toFixed(2)}
              </p>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              The server reloads Product price, packaging, Customer ownership, and active BOM before saving.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(
            workflow === "BLANKET_RELEASE" && parentOrderId
              ? `/customer-orders/${parentOrderId}`
              : mode === "edit" && orderId
                ? `/customer-orders/${orderId}`
                : "/customer-orders"
          )}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Validating and saving..."
            : mode === "edit"
              ? "Save and revalidate"
              : workflow === "BLANKET_RELEASE"
                ? "Create Blanket release"
                : "Create Customer PO"}
        </Button>
      </div>
    </form>
  )
}
