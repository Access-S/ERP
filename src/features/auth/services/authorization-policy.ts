import {
  isPermissionKey,
  type PermissionKey,
} from "../config/authorization-registry.ts"

export type AccountStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED"

export type AuthorizationErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "SESSION_USER_NOT_FOUND"
  | "SESSION_STALE"
  | "ACCOUNT_NOT_ACTIVE"
  | "PERMISSION_DENIED"

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode
  readonly status: 401 | 403
  readonly requiredPermission?: PermissionKey

  constructor(
    code: AuthorizationErrorCode,
    status: 401 | 403,
    message: string,
    requiredPermission?: PermissionKey
  ) {
    super(message)
    this.name = "AuthorizationError"
    this.code = code
    this.status = status
    this.requiredPermission = requiredPermission
  }
}

export type SessionIdentity = {
  userId: string
  authVersion: number | null | undefined
}

export type UserAccessRecord = {
  id: string
  email: string
  normalizedEmail: string
  name: string
  status: AccountStatus
  authVersion: number
  roleAssignments: readonly {
    role: {
      key: string
      isActive: boolean
      rolePermissions: readonly {
        permission: {
          key: string
          isActive: boolean
        }
      }[]
    }
  }[]
}

export type AuthorizationPrincipal = {
  userId: string
  email: string
  normalizedEmail: string
  name: string
  status: "ACTIVE"
  authVersion: number
  roleKeys: readonly string[]
  permissionKeys: readonly PermissionKey[]
}

function authenticationError(
  code: Exclude<AuthorizationErrorCode, "ACCOUNT_NOT_ACTIVE" | "PERMISSION_DENIED">,
  message: string
): AuthorizationError {
  return new AuthorizationError(code, 401, message)
}

export function resolvePrincipalFromAccessRecord(
  sessionIdentity: SessionIdentity | null,
  user: UserAccessRecord | null
): AuthorizationPrincipal {
  if (!sessionIdentity?.userId) {
    throw authenticationError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required"
    )
  }
  if (!Number.isInteger(sessionIdentity.authVersion)) {
    throw authenticationError(
      "SESSION_STALE",
      "The session must be renewed"
    )
  }
  if (!user || user.id !== sessionIdentity.userId) {
    throw authenticationError(
      "SESSION_USER_NOT_FOUND",
      "The session user is no longer available"
    )
  }
  if (user.authVersion !== sessionIdentity.authVersion) {
    throw authenticationError(
      "SESSION_STALE",
      "The session must be renewed"
    )
  }
  if (user.status !== "ACTIVE") {
    throw new AuthorizationError(
      "ACCOUNT_NOT_ACTIVE",
      403,
      "The account is not active"
    )
  }

  const roleKeys = new Set<string>()
  const permissionKeys = new Set<PermissionKey>()

  for (const assignment of user.roleAssignments) {
    if (!assignment.role.isActive) continue
    roleKeys.add(assignment.role.key)

    for (const grant of assignment.role.rolePermissions) {
      if (
        grant.permission.isActive &&
        isPermissionKey(grant.permission.key)
      ) {
        permissionKeys.add(grant.permission.key)
      }
    }
  }

  return {
    userId: user.id,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    name: user.name,
    status: "ACTIVE",
    authVersion: user.authVersion,
    roleKeys: [...roleKeys].sort(),
    permissionKeys: [...permissionKeys].sort(),
  }
}

export function hasPermission(
  principal: AuthorizationPrincipal,
  permission: PermissionKey
): boolean {
  return principal.permissionKeys.includes(permission)
}

export function assertPermission(
  principal: AuthorizationPrincipal,
  permission: PermissionKey
): void {
  if (!hasPermission(principal, permission)) {
    throw new AuthorizationError(
      "PERMISSION_DENIED",
      403,
      "Permission denied",
      permission
    )
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}
