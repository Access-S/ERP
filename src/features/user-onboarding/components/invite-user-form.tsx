"use client"

import { MailPlus, RotateCcw } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inviteUserAction } from "../actions/user-onboarding-actions"
import { ActivationLinkPanel } from "./activation-link-panel"

type RoleOption = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
}

type InvitationResult = {
  userId: string
  activationPath: string
  expiresAt: string
}

export function InviteUserForm({ roles }: { roles: readonly RoleOption[] }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [invitation, setInvitation] = useState<InvitationResult | null>(null)

  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) => {
      const next = new Set(current)
      if (checked) next.add(roleId)
      else next.delete(roleId)
      return next
    })
  }

  function resetForm() {
    setName("")
    setEmail("")
    setSelectedRoleIds(new Set())
    setInvitation(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await inviteUserAction({
          name,
          email,
          roleIds: [...selectedRoleIds],
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        if (!result.userId || !result.activationPath || !result.expiresAt) {
          toast.error("The invitation was created, but its link could not be displayed.")
          return
        }
        setInvitation({
          userId: result.userId,
          activationPath: result.activationPath,
          expiresAt: result.expiresAt,
        })
        toast.success("User invited")
      } catch (error) {
        console.error("Invitation response failed", error)
        toast.error("The server response could not be read. Refresh before trying again.")
      }
    })
  }

  if (invitation) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-success">
            <MailPlus className="h-5 w-5" />
            <h2 className="font-heading text-lg font-semibold">Invitation ready</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            The account is inactive until its recipient creates a password.
          </p>
        </div>
        <ActivationLinkPanel {...invitation} />
        <Button type="button" variant="outline" onClick={resetForm}>
          <RotateCcw />
          Invite another user
        </Button>
      </div>
    )
  }

  return (
    <form className="space-y-7" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Full name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Morgan"
            autoComplete="name"
            maxLength={100}
            className="h-11"
            disabled={isPending}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Work email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="alex@company.com"
            autoComplete="email"
            maxLength={254}
            className="h-11"
            disabled={isPending}
            required
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <div>
          <legend className="text-sm font-medium">Starting roles</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign at least one role. Permissions from multiple roles are combined.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {roles.map((role) => {
            const checked = selectedRoleIds.has(role.id)
            return (
              <Label
                key={role.id}
                htmlFor={`invite-role-${role.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
              >
                <Checkbox
                  id={`invite-role-${role.id}`}
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
                    {role.description ?? "No description"} · {role.permissionCount} permissions
                  </span>
                </span>
              </Label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <p className="max-w-xl text-xs text-muted-foreground">
          The invitation expires after 48 hours. The user cannot sign in until activation.
        </p>
        <Button
          type="submit"
          loading={isPending}
          disabled={selectedRoleIds.size === 0}
          className="h-10"
        >
          <MailPlus />
          Create invitation
        </Button>
      </div>
    </form>
  )
}
