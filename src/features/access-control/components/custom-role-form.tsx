"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createCustomRoleAction,
  updateCustomRoleAction,
} from "../actions/access-control-actions"

export type PermissionOption = {
  id: string
  key: string
  module: string
  description: string
}

type RoleFormValues = {
  name: string
  description: string
  permissionIds: readonly string[]
}

export function CustomRoleForm({
  mode,
  roleId,
  permissions,
  initialValues,
  duplicateSourceName,
}: {
  mode: "create" | "edit"
  roleId?: string
  permissions: readonly PermissionOption[]
  initialValues: RoleFormValues
  duplicateSourceName?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [name, setName] = React.useState(initialValues.name)
  const [description, setDescription] = React.useState(initialValues.description)
  const [selectedPermissionIds, setSelectedPermissionIds] = React.useState(
    () => new Set(initialValues.permissionIds)
  )
  const [search, setSearch] = React.useState("")

  const groupedPermissions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const groups = new Map<string, PermissionOption[]>()
    for (const permission of permissions) {
      if (
        normalizedSearch &&
        !permission.key.toLowerCase().includes(normalizedSearch) &&
        !permission.description.toLowerCase().includes(normalizedSearch) &&
        !permission.module.toLowerCase().includes(normalizedSearch)
      ) {
        continue
      }
      const group = groups.get(permission.module) ?? []
      group.push(permission)
      groups.set(permission.module, group)
    }
    return [...groups.entries()]
  }, [permissions, search])

  const initialKey = [
    initialValues.name,
    initialValues.description,
    ...[...initialValues.permissionIds].sort(),
  ].join("|")
  const currentKey = [
    name,
    description,
    ...[...selectedPermissionIds].sort(),
  ].join("|")
  const hasChanged = initialKey !== currentKey

  function togglePermission(permissionId: string, checked: boolean) {
    setSelectedPermissionIds((current) => {
      const next = new Set(current)
      if (checked) next.add(permissionId)
      else next.delete(permissionId)
      return next
    })
  }

  function toggleModule(modulePermissions: readonly PermissionOption[]) {
    setSelectedPermissionIds((current) => {
      const next = new Set(current)
      const allSelected = modulePermissions.every((permission) => next.has(permission.id))
      for (const permission of modulePermissions) {
        if (allSelected) next.delete(permission.id)
        else next.add(permission.id)
      }
      return next
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const values = {
          name,
          description,
          permissionIds: [...selectedPermissionIds],
        }
        const result = mode === "edit" && roleId
          ? await updateCustomRoleAction({ roleId, ...values })
          : await createCustomRoleAction(values)

        if (!result.success || !result.roleId) {
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        if (result.requiresReauthentication) {
          await signOut({ callbackUrl: "/login" })
          return
        }
        router.push(`/settings/access/roles/${result.roleId}`)
      } catch (error) {
        console.error("Custom role response failed", error)
        toast.error("The server response could not be read. Refresh the page before trying again.")
      }
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {duplicateSourceName && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          Starting from <span className="font-medium">{duplicateSourceName}</span>. Saving creates a separate custom role and never changes the source.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role identity</CardTitle>
          <CardDescription>
            Use a clear job-function name. The permanent internal key is generated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              autoFocus
              disabled={isPending}
              placeholder="Example: Site Manager"
            />
          </div>
          <div className="space-y-2 lg:row-span-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              disabled={isPending}
              placeholder="Explain who should receive this role and what it is responsible for."
              className="min-h-24"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Names must be unique regardless of letter case. Renaming does not change the role’s permanent identifier.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Permission catalogue</CardTitle>
              <CardDescription className="mt-1">
                Access is additive. Select only the operations this role genuinely needs.
              </CardDescription>
            </div>
            <Badge variant="secondary">{selectedPermissionIds.size} selected</Badge>
          </div>
          <div className="relative mt-3 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search permissions"
              className="pl-8"
              disabled={isPending}
            />
          </div>
        </CardHeader>
        <CardContent>
          {groupedPermissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permissions match your search.</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {groupedPermissions.map(([module, modulePermissions]) => {
                const selectedCount = modulePermissions.filter((permission) =>
                  selectedPermissionIds.has(permission.id)
                ).length
                const allSelected = selectedCount === modulePermissions.length
                return (
                  <div key={module} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium">{module}</h2>
                        <Badge variant={module === "ADMIN" ? "destructive" : "outline"}>
                          {selectedCount}/{modulePermissions.length}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => toggleModule(modulePermissions)}
                      >
                        {allSelected ? "Clear module" : "Select module"}
                      </Button>
                    </div>
                    {module === "ADMIN" && (
                      <p className="mb-3 text-xs text-destructive">
                        Administrative permissions can change accounts, roles, or system configuration.
                      </p>
                    )}
                    <div className="space-y-2">
                      {modulePermissions.map((permission) => (
                        <Label
                          key={permission.id}
                          htmlFor={`permission-${permission.id}`}
                          className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`permission-${permission.id}`}
                            checked={selectedPermissionIds.has(permission.id)}
                            onCheckedChange={(value) =>
                              togglePermission(permission.id, value === true)
                            }
                            disabled={isPending}
                          />
                          <span className="min-w-0">
                            <code className="text-xs font-medium text-foreground">{permission.key}</code>
                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                              {permission.description}
                            </span>
                          </span>
                        </Label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} asChild>
          <Link href={roleId ? `/settings/access/roles/${roleId}` : "/settings/access/roles"}>
            Cancel
          </Link>
        </Button>
        <Button
          type="submit"
          loading={isPending}
          disabled={!hasChanged || selectedPermissionIds.size === 0 || name.trim().length < 2}
        >
          {mode === "edit" ? "Save custom role" : "Create custom role"}
        </Button>
      </div>
    </form>
  )
}
