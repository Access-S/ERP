"use client"

import * as React from "react"
import { Ban } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancelStandardCustomerOrderAction } from "../actions/customer-order-actions"

export function CustomerOrderCancelAction({
  orderId,
  releaseId,
  customerPoNumber,
}: {
  orderId: string
  releaseId: string
  customerPoNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  function cancel() {
    startTransition(async () => {
      const result = await cancelStandardCustomerOrderAction({ orderId, releaseId, reason })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Ban className="mr-2 h-4 w-4" />Cancel PO</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Customer PO {customerPoNumber}?</DialogTitle>
          <DialogDescription>
            The order will be locked and removed from ready demand. Its revisions and audit history remain available.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Customer instruction or cancellation reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={500}
            disabled={isPending}
            placeholder="Example: Customer cancelled by email on 14 Sep 2026"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isPending}>Keep PO</Button></DialogClose>
          <Button variant="destructive" onClick={cancel} disabled={isPending || reason.trim().length < 10}>
            {isPending ? "Cancelling..." : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
