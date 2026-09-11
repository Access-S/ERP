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

export default async function NewCustomRolePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.role.manage")) {
    return <PermissionDenied description="You need permission to create custom roles." backHref="/settings/access/roles" backLabel="Return to roles" />
  }

  const { duplicate } = await searchParams
  if (duplicate && !z.string().uuid().safeParse(duplicate).success) notFound()
  const [permissions, sourceRole] = await Promise.all([
    getPermissionCatalogue(),
    duplicate ? getAccessControlRole(duplicate) : Promise.resolve(null),
  ])
  if (duplicate && !sourceRole) notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/access/roles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Roles
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {sourceRole ? "Duplicate role" : "New custom role"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Build a company-specific role from the controlled permission catalogue.
        </p>
      </div>

      <CustomRoleForm
        mode="create"
        permissions={permissions}
        duplicateSourceName={sourceRole?.name}
        initialValues={{
          name: sourceRole ? `Copy of ${sourceRole.name}`.slice(0, 80) : "",
          description: sourceRole?.description ?? "",
          permissionIds: sourceRole?.rolePermissions.map(({ permission }) => permission.id) ?? [],
        }}
      />
    </div>
  )
}
