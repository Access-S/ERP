import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAccessControlRoles } from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { InviteUserForm } from "@/features/user-onboarding/components/invite-user-form"

export const dynamic = "force-dynamic"

export default async function InviteUserPage() {
  const principal = await getCurrentPrincipal()
  if (
    !principal ||
    !hasPermission(principal, "admin.user.invite") ||
    !hasPermission(principal, "admin.role.assign")
  ) {
    return <PermissionDenied description="You need permission to invite users and assign their initial roles." />
  }

  const roles = await getAccessControlRoles()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/access/users">
            <ArrowLeft />
            Users
          </Link>
        </Button>
        <h1 className="sr-only">Invite user</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            The recipient chooses their own password. Administrators never need to know it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm
            roles={roles
              .filter((role) => role.isActive)
              .map((role) => ({
                id: role.id,
                name: role.name,
                description: role.description,
                isSystem: role.isSystem,
                permissionCount: role.rolePermissions.length,
              }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
