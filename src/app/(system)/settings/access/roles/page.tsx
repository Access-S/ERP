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
import { getAccessControlRoles } from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"

export const dynamic = "force-dynamic"

export default async function AccessControlRolesPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.user.view")) {
    return <PermissionDenied description="You need permission to view roles and permissions." />
  }

  const roles = await getAccessControlRoles()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Roles and permissions</h1>
        <p className="text-sm text-muted-foreground">
          Standard templates are locked reference roles. Open one to inspect its exact access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role catalogue</CardTitle>
          <CardDescription>
            Custom role creation will be added after assignment controls and safety rules are verified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Assigned users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <ClickableTableRow key={role.id} href={`/settings/access/roles/${role.id}`}>
                  <TableCell>
                    <div className="font-medium">{role.name}</div>
                    <div className="max-w-xl text-xs text-muted-foreground">
                      {role.description ?? "No description"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.isSystem ? "Standard" : "Custom"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isActive ? "default" : "outline"}>
                      {role.isActive ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>{role.rolePermissions.length}</TableCell>
                  <TableCell>{role._count.userRoles}</TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
