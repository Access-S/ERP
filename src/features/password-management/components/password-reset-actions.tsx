"use client"

import { KeyRound } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SensitiveChangeReasonField } from "@/features/security-audit/components/sensitive-change-reason-field"
import { isSensitiveChangeReasonReady } from "@/features/security-audit/types/sensitive-change-reason"
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
import { createPasswordResetLinkAction } from "../actions/password-actions"
import { PasswordResetLinkPanel } from "./password-reset-link-panel"

export function PasswordResetActions({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const [reset, setReset] = useState<{ resetPath: string; expiresAt: string } | null>(null)

  function createLink() {
    startTransition(async () => {
      try {
        const result = await createPasswordResetLinkAction({ userId, reason })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        if (!result.resetPath || !result.expiresAt) {
          toast.error("The link was created but could not be displayed.")
          return
        }
        setReset({ resetPath: result.resetPath, expiresAt: result.expiresAt })
        setOpen(false)
        setReason("")
        toast.success("Password reset link created")
      } catch (error) {
        console.error("Password reset link response failed", error)
        toast.error("The server response could not be read. Refresh before trying again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {reset && <PasswordResetLinkPanel {...reset} />}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen && !isPending) setReason("")
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <KeyRound />
            {reset ? "Create another reset link" : "Create password reset link"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a password reset link?</DialogTitle>
            <DialogDescription>
              Any existing unused reset link for this account will be revoked. The new
              link expires after one hour and must be shared privately.
            </DialogDescription>
          </DialogHeader>
          <SensitiveChangeReasonField
            id="password-reset-reason"
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
              onClick={createLink}
            >
              Create secure link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
