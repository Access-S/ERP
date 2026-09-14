"use client"

import * as React from "react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SensitiveChangeReasonField } from "@/features/security-audit/components/sensitive-change-reason-field"
import { isSensitiveChangeReasonReady } from "@/features/security-audit/types/sensitive-change-reason"
import { assignUserRolesAction } from "../actions/access-control-actions"

type RoleOption = {
  id: string
  name: string
  description: string | null
  permissionCount: number
  isSystem: boolean
}

export function RoleAssignmentForm({
  userId,
  roles,
  initialRoleIds,
}: {
  userId: string
  roles: readonly RoleOption[]
  initialRoleIds: readonly string[]
}) {
  const [isPending, startTransition] = React.useTransition()
  const [reason, setReason] = React.useState("")
  const [selectedRoleIds, setSelectedRoleIds] = React.useState(
    () => new Set(initialRoleIds)
  )
  const initialKey = [...initialRoleIds].sort().join(",")
  const selectedKey = [...selectedRoleIds].sort().join(",")
  const hasChanged = initialKey !== selectedKey

  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) => {
      const next = new Set(current)
      if (checked) next.add(roleId)
      else next.delete(roleId)
      return next
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await assignUserRolesAction({
          userId,
          roleIds: [...selectedRoleIds],
          reason,
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }

        toast.success(result.message)
        setReason("")
        if (result.requiresReauthentication) {
          await signOut({ callbackUrl: "/login" })
        }
      } catch (error) {
        console.error("Role assignment response failed", error)
        toast.error("The server response could not be read. Refresh the page before trying again.")
      }
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-3 lg:grid-cols-2">
        {roles.map((role) => {
          const checked = selectedRoleIds.has(role.id)
          return (
            <Label
              key={role.id}
              htmlFor={`role-${role.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                id={`role-${role.id}`}
                checked={checked}
                disabled={isPending}
                onCheckedChange={(value) => toggleRole(role.id, value === true)}
              />
              <span className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {role.name}
                  {role.isSystem && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Standard
                    </span>
                  )}
                </span>
                <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                  {role.description ?? "No description"} · {role.permissionCount}{" "}
                  {role.permissionCount === 1 ? "permission" : "permissions"}
                </span>
              </span>
            </Label>
          )
        })}
      </div>

      {hasChanged && (
        <SensitiveChangeReasonField
          id="role-assignment-reason"
          value={reason}
          onChange={setReason}
          disabled={isPending}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Permissions from every selected role are combined. At least one role is required.
        </p>
        <Button
          type="submit"
          loading={isPending}
          disabled={
            !hasChanged ||
            selectedRoleIds.size === 0 ||
            !isSensitiveChangeReasonReady(reason)
          }
        >
          Save role assignments
        </Button>
      </div>
    </form>
  )
}
