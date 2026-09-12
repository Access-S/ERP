import Link from "next/link"
import { ArrowLeft, MailPlus } from "lucide-react"
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
        <div className="flex items-center gap-2">
          <MailPlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Invite user</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Create an inactive account, assign its initial responsibilities, and issue a secure setup link.
        </p>
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
