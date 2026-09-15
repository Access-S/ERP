"use client"

import * as React from "react"
import { CircleDollarSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { addBlanketAmendmentAction } from "../actions/customer-order-actions"

export function BlanketTopUpAction({ orderId, customerPoNumber, today }: {
  orderId: string
  customerPoNumber: string
  today: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [valueDelta, setValueDelta] = React.useState("")
  const [customerReference, setCustomerReference] = React.useState("")
  const [receivedDate, setReceivedDate] = React.useState(today)
  const [effectiveDate, setEffectiveDate] = React.useState(today)
  const [reason, setReason] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  function submit() {
    startTransition(async () => {
      const result = await addBlanketAmendmentAction({
        orderId,
        valueDelta,
        customerReference,
        receivedDate,
        effectiveDate,
        reason,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setOpen(false)
      setValueDelta("")
      setCustomerReference("")
      setReason("")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><CircleDollarSign className="mr-2 h-4 w-4" />Record top-up</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up Blanket PO {customerPoNumber}</DialogTitle>
          <DialogDescription>
            This creates an append-only amendment. The original authorised value will not be overwritten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="top-up-value">Additional value (ex GST)</Label>
            <Input id="top-up-value" type="number" min="0.01" step="0.01" value={valueDelta} onChange={(event) => setValueDelta(event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="top-up-reference">Customer reference (optional)</Label>
            <Input id="top-up-reference" value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} maxLength={100} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="top-up-received">Received date</Label>
            <Input id="top-up-received" type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="top-up-effective">Effective date</Label>
            <Input id="top-up-effective" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="top-up-reason">Reason or customer instruction</Label>
            <Textarea id="top-up-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} disabled={isPending} placeholder="Example: Customer increased annual PO authority by email" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isPending}>Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={isPending || !valueDelta || reason.trim().length < 10}>
            {isPending ? "Recording..." : "Record top-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
