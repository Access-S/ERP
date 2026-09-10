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
import { setPartActiveAction } from "../actions/part-actions"

// ---------------- BLOCK 2: Component ----------------
interface PartStatusActionsProps {
  partId: string
  partCode: string
  isActive: boolean
  activeBomCount: number
  canEdit: boolean
  canChangeStatus: boolean
}

export function PartStatusActions({
  partId,
  partCode,
  isActive,
  activeBomCount,
  canEdit,
  canChangeStatus,
}: PartStatusActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const deactivateBlocked = isActive && activeBomCount > 0

  if (!canEdit && !canChangeStatus) return null

  function handleStatusChange() {
    startTransition(async () => {
      const result = await setPartActiveAction({ partId, isActive: !isActive })
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
            <Link href={`/products/parts/${partId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Part
            </Link>
          </Button>
        )}

        {canChangeStatus && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={isActive ? "destructive" : "default"}
                disabled={deactivateBlocked}
                title={deactivateBlocked ? "This Part is used by an active BOM." : undefined}
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
                  {isActive ? `Deactivate ${partCode}?` : `Reactivate ${partCode}?`}
                </DialogTitle>
                <DialogDescription>
                  {isActive
                    ? "The Part will remain in historical BOMs but will no longer be available for new draft BOM lines."
                    : "The Part will become available for selection in draft BOMs again."}
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
                  {isActive ? "Deactivate Part" : "Reactivate Part"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canChangeStatus && deactivateBlocked && (
        <p className="max-w-sm text-right text-xs text-muted-foreground">
          Used by {activeBomCount} active {activeBomCount === 1 ? "BOM" : "BOMs"}. Revise those BOMs before deactivation.
        </p>
      )}
    </div>
  )
}
