import Link from "next/link"
import { History, KeyRound, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { getAccessControlOverview } from "@/features/access-control/services/access-control-service"

export const dynamic = "force-dynamic"

export default async function AccessControlPage() {
  const principal = await getCurrentPrincipal()
  const canViewUsers = Boolean(
    principal && hasPermission(principal, "admin.user.view")
  )
  const canViewAudit = Boolean(
    principal && hasPermission(principal, "admin.audit.view")
  )
  if (!principal || (!canViewUsers && !canViewAudit)) {
    return <PermissionDenied description="You need permission to view user access." />
  }

  const overview = canViewUsers ? await getAccessControlOverview() : null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Access Control</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage who can use the ERP and understand the access granted by each role.
        </p>
      </div>

      {overview && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl">{overview.totalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active users</CardDescription>
            <CardTitle className="text-3xl">{overview.activeUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting activation</CardDescription>
            <CardTitle className="text-3xl">{overview.invitedUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suspended or disabled</CardDescription>
            <CardTitle className="text-3xl">{overview.restrictedUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active roles</CardDescription>
            <CardTitle className="text-3xl">{overview.activeRoles}</CardTitle>
          </CardHeader>
        </Card>
      </div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {overview && <Card>
          <CardHeader>
            <Users className="mb-2 h-5 w-5 text-primary" />
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Review account status, assigned roles, recent sign-in activity, and effective access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/access/users">Manage users</Link>
            </Button>
          </CardContent>
        </Card>}

        {overview && <Card>
          <CardHeader>
            <KeyRound className="mb-2 h-5 w-5 text-primary" />
            <CardTitle>Roles and permissions</CardTitle>
            <CardDescription>
              Inspect the standard role templates and the exact permissions each one grants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" asChild>
              <Link href="/settings/access/roles">View roles</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              {overview.customRoles} custom roles currently exist alongside the standard templates.
            </p>
          </CardContent>
        </Card>}

        {canViewAudit && (
          <Card>
            <CardHeader>
              <History className="mb-2 h-5 w-5 text-primary" />
              <CardTitle>Security monitoring</CardTitle>
              <CardDescription>
                See prioritised sign-in, credential, account, role, and access-denial activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/settings/access/audit">Open security monitoring</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
