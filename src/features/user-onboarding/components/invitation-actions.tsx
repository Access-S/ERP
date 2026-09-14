"use client"

import { RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"
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
import { SensitiveChangeReasonField } from "@/features/security-audit/components/sensitive-change-reason-field"
import { isSensitiveChangeReasonReady } from "@/features/security-audit/types/sensitive-change-reason"
import { reissueInvitationAction } from "../actions/user-onboarding-actions"
import { ActivationLinkPanel } from "./activation-link-panel"

export function InvitationActions({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const [invitation, setInvitation] = useState<{
    activationPath: string
    expiresAt: string
  } | null>(null)

  function reissue() {
    startTransition(async () => {
      try {
        const result = await reissueInvitationAction({ userId, reason })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        if (!result.activationPath || !result.expiresAt) {
          toast.error("The link was created but could not be displayed.")
          return
        }
        setInvitation({ activationPath: result.activationPath, expiresAt: result.expiresAt })
        setOpen(false)
        setReason("")
        toast.success("Activation link replaced")
      } catch (error) {
        console.error("Invitation reissue response failed", error)
        toast.error("The server response could not be read. Refresh before trying again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {invitation && <ActivationLinkPanel {...invitation} />}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen && !isPending) setReason("")
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <RefreshCw />
            {invitation ? "Create another link" : "Replace activation link"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace this activation link?</DialogTitle>
            <DialogDescription>
              Every previous unused activation link for this account will be revoked.
            </DialogDescription>
          </DialogHeader>
          <SensitiveChangeReasonField
            id="invitation-reissue-reason"
            value={reason}
            onChange={setReason}
            disabled={isPending}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button
              loading={isPending}
              disabled={!isSensitiveChangeReasonReady(reason)}
              onClick={reissue}
            >
              Replace secure link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">
        Replacing the link revokes every previous unused link for this account.
      </p>
    </div>
  )
}
