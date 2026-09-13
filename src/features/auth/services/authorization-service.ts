import "server-only"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { writeSecurityAuditEvent } from "@/features/security-audit/services/audit-service"
import type { PermissionKey } from "../config/authorization-registry"
import {
  assertPermission,
  AuthorizationError,
  resolvePrincipalFromAccessRecord,
  type AuthorizationPrincipal,
  type SessionIdentity,
} from "./authorization-policy"
import { authorizationUserSelect } from "./authorization-user-select"

async function loadCurrentPrincipal(): Promise<AuthorizationPrincipal> {
  const session = await auth()
  const sessionIdentity: SessionIdentity | null = session?.user?.id
    ? {
        userId: session.user.id,
        authVersion: session.user.authVersion,
      }
    : null

  if (!sessionIdentity) {
    return resolvePrincipalFromAccessRecord(null, null)
  }
  if (!Number.isInteger(sessionIdentity.authVersion)) {
    return resolvePrincipalFromAccessRecord(sessionIdentity, null)
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionIdentity.userId },
    select: authorizationUserSelect,
  })

  return resolvePrincipalFromAccessRecord(sessionIdentity, user)
}

export async function getCurrentPrincipal(): Promise<AuthorizationPrincipal | null> {
  try {
    return await loadCurrentPrincipal()
  } catch (error) {
    if (error instanceof AuthorizationError) return null
    throw error
  }
}

export async function requireUser(): Promise<AuthorizationPrincipal> {
  return loadCurrentPrincipal()
}

export async function requirePermission(
  permission: PermissionKey
): Promise<AuthorizationPrincipal> {
  const principal = await loadCurrentPrincipal()
  try {
    assertPermission(principal, permission)
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "PERMISSION_DENIED") {
      try {
        await writeSecurityAuditEvent({
          eventType: "auth.access.denied",
          outcome: "DENIED",
          actorUserId: principal.userId,
          targetType: "PERMISSION",
          targetId: permission,
          reasonCode: error.code,
          metadata: { permissionKey: permission, resourceType: "SERVER_OPERATION" },
        })
      } catch (auditError) {
        console.error("Security access denial could not be audited", auditError)
      }
    }
    throw error
  }
  return principal
}
