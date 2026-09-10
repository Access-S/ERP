"use client"

// ---------------- BLOCK 1: Imports ----------------
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Pencil, RotateCcw } from "lucide-react"
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
import { setCustomerActiveAction } from "../actions/customer-actions"

// ---------------- BLOCK 2: Component ----------------
interface CustomerStatusActionsProps {
  customerId: string
  customerCode: string
  isActive: boolean
  activeProductCount: number
  openPurchaseOrderCount: number
  canEdit: boolean
  canChangeStatus: boolean
}

export function CustomerStatusActions({
  customerId,
  customerCode,
  isActive,
  activeProductCount,
  openPurchaseOrderCount,
  canEdit,
  canChangeStatus,
}: CustomerStatusActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const blocked = isActive && (activeProductCount > 0 || openPurchaseOrderCount > 0)
  const blockers = [
    activeProductCount > 0
      ? `${activeProductCount} active ${activeProductCount === 1 ? "Product" : "Products"}`
      : null,
    openPurchaseOrderCount > 0
      ? `${openPurchaseOrderCount} live purchase ${openPurchaseOrderCount === 1 ? "order" : "orders"}`
      : null,
  ].filter((value): value is string => value !== null)

  function handleStatusChange() {
    startTransition(async () => {
      const result = await setCustomerActiveAction({ customerId, isActive: !isActive })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  if (!canEdit && !canChangeStatus) return null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/products/customers/${customerId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Customer
            </Link>
          </Button>
        )}
        {canChangeStatus && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={isActive ? "destructive" : "default"}
                disabled={blocked}
                title={blocked ? "Resolve active Products and live purchase orders first." : undefined}
              >
                {isActive ? (
                  <Archive className="mr-2 h-4 w-4" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isActive ? `Deactivate ${customerCode}?` : `Reactivate ${customerCode}?`}
                </DialogTitle>
                <DialogDescription>
                  {isActive
                    ? "The Customer will remain available in historical Products and orders but cannot be assigned to new Products."
                    : "The Customer will become available for Product assignment again."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button
                  variant={isActive ? "destructive" : "default"}
                  onClick={handleStatusChange}
                  loading={isPending}
                >
                  {isActive ? "Deactivate Customer" : "Reactivate Customer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {canChangeStatus && blocked && (
        <p className="max-w-sm text-right text-xs text-muted-foreground">
          Resolve {blockers.join(" and ")} before deactivation.
        </p>
      )}
    </div>
  )
}
