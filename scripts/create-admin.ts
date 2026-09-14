import { randomUUID } from "node:crypto"
import { PrismaClient, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { sanitizeAuditMetadata } from "../src/features/security-audit/services/audit-policy.ts"
import { resolveBootstrapAdminConfig } from "./bootstrap-admin-policy.ts"

const prisma = new PrismaClient()

async function main() {
  const config = resolveBootstrapAdminConfig(process.env, process.argv.slice(2))
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD
  const passwordHash = await bcrypt.hash(config.password, 12)
  const correlationId = randomUUID()

  const result = await prisma.$transaction(async (tx) => {
    const systemAdminRole = await tx.role.findUnique({
      where: { key: "SYSTEM_ADMIN" },
      select: { id: true, key: true, isActive: true },
    })
    if (!systemAdminRole?.isActive) {
      throw new Error("SYSTEM_ADMIN is not seeded. Run npm run seed:auth first.")
    }

    const existingUser = await tx.user.findUnique({
      where: { normalizedEmail: config.email },
      select: {
        id: true,
        status: true,
        password: true,
        roleAssignments: {
          where: { roleId: systemAdminRole.id, role: { isActive: true } },
          select: { roleId: true },
        },
      },
    })

    if (existingUser) {
      if (existingUser.roleAssignments.length === 0) {
        throw new Error(
          "An existing non-administrator uses this email; refusing to elevate it"
        )
      }
      if (existingUser.status !== "ACTIVE" || !existingUser.password) {
        throw new Error(
          "The existing bootstrap administrator is not recoverable. Restore it through an approved recovery procedure."
        )
      }
      return { id: existingUser.id, created: false }
    }

    const existingActiveAdministratorCount = await tx.user.count({
      where: {
        status: "ACTIVE",
        password: { not: null },
        roleAssignments: {
          some: { roleId: systemAdminRole.id, role: { isActive: true } },
        },
      },
    })
    if (existingActiveAdministratorCount > 0) {
      throw new Error(
        "An active System Administrator already exists. Invite additional administrators through Access Control."
      )
    }

    const user = await tx.user.create({
      data: {
        email: config.email,
        normalizedEmail: config.email,
        password: passwordHash,
        name: config.name,
        role: systemAdminRole.key,
        status: UserStatus.ACTIVE,
        roleAssignments: {
          create: { roleId: systemAdminRole.id },
        },
      },
      select: { id: true },
    })

    await tx.securityAuditEvent.create({
      data: {
        eventType: "auth.bootstrap_admin.created",
        outcome: "SUCCESS",
        targetType: "USER",
        targetId: user.id,
        correlationId,
        metadata: sanitizeAuditMetadata("auth.bootstrap_admin.created", {
          environment: config.deploymentEnvironment,
          reason: config.reason,
        }),
      },
    })

    return { id: user.id, created: true }
  }, { isolationLevel: "Serializable" })

  console.log(
    result.created
      ? `Bootstrap administrator created: ${result.id}`
      : `Bootstrap administrator already exists: ${result.id}`
  )
}

main()
  .catch((error) => {
    console.error("Bootstrap administrator failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
