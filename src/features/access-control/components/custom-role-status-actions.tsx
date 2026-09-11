"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Archive, Copy, Pencil, RotateCcw } from "lucide-react"
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
import { setCustomRoleActiveAction } from "../actions/access-control-actions"

export function CustomRoleStatusActions({
  roleId,
  roleName,
  isSystem,
  isActive,
  assignedUserCount,
  canManage,
}: {
  roleId: string
  roleName: string
  isSystem: boolean
  isActive: boolean
  assignedUserCount: number
  canManage: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  function updateStatus() {
    startTransition(async () => {
      try {
        const result = await setCustomRoleActiveAction({
          roleId,
          isActive: !isActive,
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        setOpen(false)
        if (result.requiresReauthentication) {
          await signOut({ callbackUrl: "/login" })
        }
      } catch (error) {
        console.error("Custom role status response failed", error)
        toast.error("The server response could not be read. Refresh the page before trying again.")
      }
    })
  }

  if (!canManage) return null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/settings/access/roles/new?duplicate=${roleId}`}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Link>
        </Button>
        {!isSystem && (
          <Button variant="outline" asChild>
            <Link href={`/settings/access/roles/${roleId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        {!isSystem && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={isActive ? "destructive" : "default"}
                disabled={isActive && assignedUserCount > 0}
              >
                {isActive ? (
                  <Archive className="mr-2 h-4 w-4" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {isActive ? "Archive" : "Reactivate"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isActive ? `Archive ${roleName}?` : `Reactivate ${roleName}?`}
                </DialogTitle>
                <DialogDescription>
                  {isActive
                    ? "The role remains in history but cannot be assigned or grant access while archived."
                    : "The role becomes available for assignment and grants its saved permissions again."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <Button
                  variant={isActive ? "destructive" : "default"}
                  loading={isPending}
                  onClick={updateStatus}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {!isSystem && isActive && assignedUserCount > 0 && (
        <p className="max-w-sm text-right text-xs text-muted-foreground">
          Remove this role from {assignedUserCount} assigned {assignedUserCount === 1 ? "user" : "users"} before archiving it.
        </p>
      )}
    </div>
  )
}
