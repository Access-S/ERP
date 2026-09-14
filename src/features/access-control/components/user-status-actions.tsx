"use client"

import * as React from "react"
import type { UserStatus } from "@prisma/client"
import { Ban, PauseCircle, RotateCcw } from "lucide-react"
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
import { setUserStatusAction } from "../actions/access-control-actions"

type ManagedUserStatus = Exclude<UserStatus, "INVITED">

const statusCopy: Record<ManagedUserStatus, { title: string; description: string }> = {
  ACTIVE: {
    title: "Reactivate account?",
    description: "The user will be able to sign in again with their existing role assignments.",
  },
  SUSPENDED: {
    title: "Suspend account?",
    description: "The user's existing sessions will become invalid and sign-in will be blocked until reactivation.",
  },
  DISABLED: {
    title: "Disable account?",
    description: "The account and role history will be retained, but the user will no longer be able to sign in.",
  },
}

function StatusDialog({
  userId,
  nextStatus,
  variant = "outline",
  children,
}: {
  userId: string
  nextStatus: ManagedUserStatus
  variant?: "outline" | "destructive" | "default"
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [isPending, startTransition] = React.useTransition()
  const copy = statusCopy[nextStatus]

  function updateStatus() {
    startTransition(async () => {
      try {
        const result = await setUserStatusAction({
          userId,
          status: nextStatus,
          reason,
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        setOpen(false)
        setReason("")
      } catch (error) {
        console.error("Account status response failed", error)
        toast.error("The server response could not be read. Refresh the page before trying again.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !isPending) setReason("")
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant}>{children}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <SensitiveChangeReasonField
          id={`user-status-reason-${nextStatus.toLowerCase()}`}
          value={reason}
          onChange={setReason}
          disabled={isPending}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>Cancel</Button>
          </DialogClose>
          <Button
            variant={variant}
            loading={isPending}
            disabled={!isSensitiveChangeReasonReady(reason)}
            onClick={updateStatus}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserStatusActions({
  userId,
  status,
  isCurrentUser,
  hasPassword = true,
}: {
  userId: string
  status: UserStatus
  isCurrentUser: boolean
  hasPassword?: boolean
}) {
  if (status === "DISABLED" && !hasPassword) return null
  if (isCurrentUser) {
    return (
      <p className="text-xs text-muted-foreground">
        Your own account status must be changed by another administrator.
      </p>
    )
  }

  if (status === "INVITED") {
    return (
      <StatusDialog userId={userId} nextStatus="DISABLED" variant="destructive">
        <Ban className="mr-2 h-4 w-4" />
        Cancel invitation
      </StatusDialog>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ACTIVE" && (
        <StatusDialog userId={userId} nextStatus="ACTIVE" variant="default">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reactivate
        </StatusDialog>
      )}
      {status === "ACTIVE" && (
        <StatusDialog userId={userId} nextStatus="SUSPENDED">
          <PauseCircle className="mr-2 h-4 w-4" />
          Suspend
        </StatusDialog>
      )}
      {status !== "DISABLED" && (
        <StatusDialog userId={userId} nextStatus="DISABLED" variant="destructive">
          <Ban className="mr-2 h-4 w-4" />
          Disable
        </StatusDialog>
      )}
    </div>
  )
}
