"use client"

// ───────────────── BLOCK 1: Imports ─────────────────
import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, CopyPlus } from "lucide-react"
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
import {
  activateBomAction,
  createBomDraftAction,
} from "../actions/bom-actions"
import type { BomHealth, BomStatus } from "../types/bom-schema"

// ───────────────── BLOCK 2: Types ─────────────────
interface BomRevisionActionsProps {
  bomId: string
  status: BomStatus
  health: BomHealth
  healthIssues: string[]
  canCreateDraft: boolean
  canActivate: boolean
}

// ───────────────── BLOCK 3: Component ─────────────────
export function BomRevisionActions({
  bomId,
  status,
  health,
  healthIssues,
  canCreateDraft,
  canActivate,
}: BomRevisionActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const isDraft = status === "DRAFT"
  const isAllowed = isDraft ? canActivate : canCreateDraft
  const isActivationReady = isDraft && health === "COMPLETE"

  const handleConfirm = React.useCallback(() => {
    startTransition(async () => {
      const result = isDraft
        ? await activateBomAction({ bomId })
        : await createBomDraftAction({ sourceBomId: bomId })

      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      if (result.bomId && result.bomId !== bomId) {
        router.push(`/products/boms/${result.bomId}`)
      } else {
        router.refresh()
      }
    })
  }, [bomId, isDraft, router])

  if (!isAllowed) return null

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={isDraft && !isActivationReady}>
            {isDraft ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <CopyPlus className="mr-2 h-4 w-4" />
            )}
            {isDraft ? "Activate BOM" : "Create Draft Revision"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isDraft ? "Activate this BOM revision?" : "Create a new draft revision?"}
            </DialogTitle>
            <DialogDescription>
              {isDraft
                ? "Activation makes this revision operational and archives the Product's current active revision in one transaction."
                : "The component lines from this revision will be copied into a new editable draft. This revision remains unchanged."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleConfirm} loading={isPending}>
              {isDraft ? "Activate Revision" : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isDraft && !canActivate && (
        <p className="max-w-72 text-right text-xs text-destructive">
          Resolve {healthIssues.length || 1} validation {healthIssues.length === 1 ? "issue" : "issues"} before activation.
        </p>
      )}
    </div>
  )
}
