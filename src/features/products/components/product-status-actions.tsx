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
import { setProductActiveAction } from "../actions/product-actions"

// ---------------- BLOCK 2: Component ----------------
interface ProductStatusActionsProps {
  productId: string
  productCode: string
  isActive: boolean
  activeBomCount: number
  draftBomCount: number
  openPurchaseOrderCount: number
  canEdit: boolean
  canChangeStatus: boolean
}

export function ProductStatusActions({
  productId,
  productCode,
  isActive,
  activeBomCount,
  draftBomCount,
  openPurchaseOrderCount,
  canEdit,
  canChangeStatus,
}: ProductStatusActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const deactivationBlocked = isActive && openPurchaseOrderCount > 0
  const operationalBomCount = activeBomCount + draftBomCount

  if (!canEdit && !canChangeStatus) return null

  function handleStatusChange() {
    startTransition(async () => {
      const result = await setProductActiveAction({ productId, isActive: !isActive })
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
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/products/catalog/${productId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Product
            </Link>
          </Button>
        )}

        {canChangeStatus && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={isActive ? "destructive" : "default"}
                disabled={deactivationBlocked}
                title={deactivationBlocked ? "Resolve open or pending purchase orders first." : undefined}
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
                  {isActive ? `Deactivate ${productCode}?` : `Reactivate ${productCode}?`}
                </DialogTitle>
                <DialogDescription>
                  {isActive
                    ? `${operationalBomCount} active or draft BOM ${operationalBomCount === 1 ? "revision" : "revisions"} will be archived. Historical BOMs and completed orders will remain available.`
                    : "The Product will return to the active catalog. Its BOMs remain archived until a new draft is prepared and activated."}
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
                  {isActive ? "Deactivate Product" : "Reactivate Product"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canChangeStatus && deactivationBlocked && (
        <p className="max-w-sm text-right text-xs text-muted-foreground">
          Resolve {openPurchaseOrderCount} open or pending purchase {openPurchaseOrderCount === 1 ? "order" : "orders"} before deactivation.
        </p>
      )}
    </div>
  )
}
