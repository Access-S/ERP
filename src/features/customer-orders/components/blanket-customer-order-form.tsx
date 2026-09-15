"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
import { createBlanketCustomerOrderAction } from "../actions/customer-order-actions"
import type { CustomerOrderCreateOptions } from "../services/customer-order-service"

export function BlanketCustomerOrderForm({
  options,
  today,
}: {
  options: CustomerOrderCreateOptions
  today: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [customerId, setCustomerId] = React.useState("")
  const [customerPoNumber, setCustomerPoNumber] = React.useState("")
  const [originalAuthorizedValue, setOriginalAuthorizedValue] = React.useState("")
  const [receivedDate, setReceivedDate] = React.useState(today)
  const [validFrom, setValidFrom] = React.useState(today)
  const [validTo, setValidTo] = React.useState("")
  const customer = options.customers.find((candidate) => candidate.id === customerId)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createBlanketCustomerOrderAction({
        customerId,
        customerPoNumber,
        originalAuthorizedValue,
        receivedDate,
        validFrom,
        validTo,
      })
      if (!result.success || !result.orderId) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push(`/customer-orders/${result.orderId}`)
      router.refresh()
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Blanket PO authority</CardTitle>
          <CardDescription>
            Record the Customer&apos;s GST-exclusive value authority and validity period. Products are added later as separate releases.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="blanket-customer">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={isPending}>
              <SelectTrigger id="blanket-customer" className="w-full">
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
            <Label htmlFor="blanket-currency">Currency</Label>
            <Input id="blanket-currency" value={customer?.currency ?? "Select Customer"} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blanket-po-number">Customer PO number</Label>
            <Input
              id="blanket-po-number"
              value={customerPoNumber}
              onChange={(event) => setCustomerPoNumber(event.target.value)}
              maxLength={100}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blanket-authority">Original authorised value (ex GST)</Label>
            <Input
              id="blanket-authority"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={originalAuthorizedValue}
              onChange={(event) => setOriginalAuthorizedValue(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blanket-received-date">Received date</Label>
            <Input
              id="blanket-received-date"
              type="date"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blanket-valid-from">Valid from</Label>
            <Input
              id="blanket-valid-from"
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blanket-valid-to">Expiry date</Label>
            <Input
              id="blanket-valid-to"
              type="date"
              min={validFrom}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              required
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/customer-orders/new")} disabled={isPending}>
          Back
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating Blanket PO..." : "Create Blanket PO"}
        </Button>
      </div>
    </form>
  )
}
