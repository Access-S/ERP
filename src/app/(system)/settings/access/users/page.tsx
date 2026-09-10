import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClickableTableRow } from "@/features/access-control/components/clickable-table-row"
import { getAccessControlUsers } from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const
  if (status === "DISABLED") return "destructive" as const
  return "outline" as const
}

export default async function AccessControlUsersPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.user.view")) {
    return <PermissionDenied description="You need permission to view user accounts." />
  }

  const users = await getAccessControlUsers()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Open a user to review and manage their combined role access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User accounts</CardTitle>
          <CardDescription>{users.length} accounts in this ERP environment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned roles</TableHead>
                <TableHead>Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const activeRoles = user.roleAssignments.filter(({ role }) => role.isActive)
                return (
                  <ClickableTableRow key={user.id} href={`/settings/access/users/${user.id}`}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-xl flex-wrap gap-1.5">
                        {activeRoles.length > 0 ? (
                          activeRoles.map(({ role }) => (
                            <Badge key={role.id} variant="secondary">{role.name}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No active roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLoginAt ? dateFormatter.format(user.lastLoginAt) : "Never"}
                    </TableCell>
                  </ClickableTableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
