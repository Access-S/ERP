import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, KeyRound, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleAssignmentForm } from "@/features/access-control/components/role-assignment-form"
import { UserStatusActions } from "@/features/access-control/components/user-status-actions"
import { InvitationActions } from "@/features/user-onboarding/components/invitation-actions"
import { PasswordResetActions } from "@/features/password-management/components/password-reset-actions"
import {
  getAccessControlRoles,
  getAccessControlUser,
  getUserCredentialState,
} from "@/features/access-control/services/access-control-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { z } from "zod"

export const dynamic = "force-dynamic"

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export default async function AccessControlUserPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPermission(principal, "admin.user.view")) {
    return <PermissionDenied description="You need permission to view user accounts." />
  }

  const { userId } = await params
  if (!z.string().uuid().safeParse(userId).success) notFound()
  const [user, roles, credentialState] = await Promise.all([
    getAccessControlUser(userId),
    getAccessControlRoles(),
    getUserCredentialState(userId),
  ])
  if (!user || !credentialState) notFound()

  const activeAssignments = user.roleAssignments.filter(({ role }) => role.isActive)
  const effectivePermissions = new Map<string, { key: string; description: string }[]>()
  for (const { role } of activeAssignments) {
    for (const { permission } of role.rolePermissions) {
      const modulePermissions = effectivePermissions.get(permission.module) ?? []
      if (!modulePermissions.some((item) => item.key === permission.key)) {
        modulePermissions.push({ key: permission.key, description: permission.description })
        effectivePermissions.set(permission.module, modulePermissions)
      }
    }
  }
  const permissionCount = [...effectivePermissions.values()].reduce(
    (total, permissions) => total + permissions.length,
    0
  )
  const canAssignRoles = hasPermission(principal, "admin.role.assign")
  const canManageUsers = hasPermission(principal, "admin.user.manage")
  const canInviteUsers = hasPermission(principal, "admin.user.invite")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/access/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Users
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <UserRound className="h-6 w-6 text-primary" />
            <h1 className="sr-only">{user.name}</h1>
            <Badge variant={user.status === "ACTIVE" ? "default" : "outline"}>
              {user.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {canManageUsers && (
          <UserStatusActions
            userId={user.id}
            status={user.status}
            isCurrentUser={user.id === principal.userId}
            hasPassword={credentialState.hasPassword}
          />
        )}
      </div>

      {(user.status === "INVITED" ||
        (user.status === "DISABLED" && !credentialState.hasPassword)) && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>
              {user.status === "INVITED" ? "Pending activation" : "Invitation cancelled"}
            </CardTitle>
            <CardDescription>
              {user.status === "INVITED"
                ? "This account cannot sign in until the recipient creates a password using a valid activation link."
                : "This account has no password and remains unavailable. Creating a new link restores it to pending activation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.status === "INVITED" && user.invitations[0] && (
              <p className="text-xs text-muted-foreground">
                Latest link expires {dateTimeFormatter.format(user.invitations[0].expiresAt)}.
              </p>
            )}
            {canInviteUsers ? (
              <InvitationActions userId={user.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask an administrator with invitation permission to issue a replacement link.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {credentialState.hasPassword && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Password recovery</CardTitle>
            </div>
            <CardDescription>
              Administrators can issue a short-lived reset link but cannot choose or view
              this user&apos;s password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.id === principal.userId ? (
              <Button variant="outline" asChild>
                <Link href="/settings/account/security">Change your password</Link>
              </Button>
            ) : canManageUsers && user.status === "ACTIVE" ? (
              <PasswordResetActions userId={user.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {user.status === "ACTIVE"
                  ? "You do not have permission to create password reset links."
                  : "Reactivate this account before creating a password reset link."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active roles</CardDescription>
            <CardTitle className="text-3xl">{activeAssignments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Effective permissions</CardDescription>
            <CardTitle className="text-3xl">{permissionCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last sign-in</CardDescription>
            <CardTitle className="text-base">
              {user.lastLoginAt ? dateTimeFormatter.format(user.lastLoginAt) : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role assignments</CardTitle>
          <CardDescription>
            A person can hold several roles; their effective permissions are the union of all selected roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canAssignRoles ? (
            <RoleAssignmentForm
              userId={user.id}
              initialRoleIds={activeAssignments.map(({ role }) => role.id)}
              roles={roles
                .filter((role) => role.isActive)
                .map((role) => ({
                  id: role.id,
                  name: role.name,
                  description: role.description,
                  permissionCount: role.rolePermissions.length,
                  isSystem: role.isSystem,
                }))}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeAssignments.map(({ role }) => (
                <Badge key={role.id} variant="secondary">{role.name}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Effective access</CardTitle>
          </div>
          <CardDescription>
            Duplicate permissions granted by multiple roles are shown once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {effectivePermissions.size === 0 ? (
            <p className="text-sm text-muted-foreground">This user has no effective permissions.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[...effectivePermissions.entries()]
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([module, permissions]) => (
                  <div key={module} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="font-medium">{module}</h2>
                      <Badge variant="outline">{permissions.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {permissions
                        .sort((left, right) => left.key.localeCompare(right.key))
                        .map((permission) => (
                          <div key={permission.key} className="text-xs">
                            <code className="font-medium text-foreground">{permission.key}</code>
                            <p className="mt-0.5 text-muted-foreground">{permission.description}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
