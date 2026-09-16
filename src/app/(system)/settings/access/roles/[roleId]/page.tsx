import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomRoleStatusActions } from "@/features/access-control/components/custom-role-status-actions"
import { getAccessControlRole } from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { z } from "zod"

export const dynamic = "force-dynamic"

export default async function AccessControlRolePage({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.user.view")) {
    return <PermissionDenied description="You need permission to view roles and permissions." />
  }

  const { roleId } = await params
  if (!z.string().uuid().safeParse(roleId).success) notFound()
  const role = await getAccessControlRole(roleId)
  if (!role) notFound()
  const canManage = hasPermission(principal, "admin.role.manage")

  const groupedPermissions = new Map<string, typeof role.rolePermissions>()
  for (const grant of role.rolePermissions) {
    const modulePermissions = groupedPermissions.get(grant.permission.module) ?? []
    modulePermissions.push(grant)
    groupedPermissions.set(grant.permission.module, modulePermissions)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/access/roles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Roles
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <LockKeyhole className="h-6 w-6 text-primary" />
            <h1 className="sr-only">{role.name}</h1>
            <Badge variant="secondary">{role.isSystem ? "Standard" : "Custom"}</Badge>
            <Badge variant={role.isActive ? "default" : "outline"}>
              {role.isActive ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {role.description ?? "No role description."}
          </p>
          <code className="text-xs text-muted-foreground">{role.key}</code>
        </div>
        <CustomRoleStatusActions
          roleId={role.id}
          roleName={role.name}
          isSystem={role.isSystem}
          isActive={role.isActive}
          assignedUserCount={role._count.userRoles}
          canManage={canManage}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Permissions granted</CardDescription>
            <CardTitle className="text-3xl">{role.rolePermissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assigned users</CardDescription>
            <CardTitle className="text-3xl">{role._count.userRoles}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {role.isSystem && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          This is a locked standard template. In the custom-role phase it can be duplicated and adjusted without changing the original.
        </div>
      )}

      {!role.isSystem && role.userRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned users</CardTitle>
            <CardDescription>
              Permission edits invalidate these users’ sessions. Remove all assignments before archiving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {role.userRoles.map(({ user }) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/settings/access/users/${user.id}`}>
                        {user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{user.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {[...groupedPermissions.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([module, permissions]) => (
            <Card key={module}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{module}</CardTitle>
                  <Badge variant="outline">{permissions.length}</Badge>
                </div>
                <CardDescription>Permissions granted in this module.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {permissions.map(({ permission }) => (
                  <div key={permission.key} className="rounded-md border p-3">
                    <code className="text-xs font-medium">{permission.key}</code>
                    <p className="mt-1 text-xs text-muted-foreground">{permission.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
