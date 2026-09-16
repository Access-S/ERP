import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { CustomRoleForm } from "@/features/access-control/components/custom-role-form"
import {
  getAccessControlRole,
  getPermissionCatalogue,
} from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"

export const dynamic = "force-dynamic"

export default async function EditCustomRolePage({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.role.manage")) {
    return <PermissionDenied description="You need permission to edit custom roles." backHref="/settings/access/roles" backLabel="Return to roles" />
  }

  const { roleId } = await params
  if (!z.string().uuid().safeParse(roleId).success) notFound()
  const [role, permissions] = await Promise.all([
    getAccessControlRole(roleId),
    getPermissionCatalogue(),
  ])
  if (!role) notFound()
  if (role.isSystem) {
    return (
      <PermissionDenied
        description="Standard roles are locked. Duplicate this role to create an editable custom role."
        backHref={`/settings/access/roles/${role.id}`}
        backLabel="Return to role"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/settings/access/roles/${role.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {role.name}
          </Link>
        </Button>
        <h1 className="sr-only">Edit custom role</h1>
        <p className="text-sm text-muted-foreground">
          Permission changes affect every assigned user and invalidate their existing sessions.
        </p>
      </div>

      <CustomRoleForm
        mode="edit"
        roleId={role.id}
        permissions={permissions}
        initialValues={{
          name: role.name,
          description: role.description ?? "",
          permissionIds: role.rolePermissions.map(({ permission }) => permission.id),
        }}
      />
    </div>
  )
}
