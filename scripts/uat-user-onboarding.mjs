import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import {
  activateAccountSchema,
  invitationTokenSchema,
  inviteUserSchema,
  passwordSchema,
} from "../src/features/user-onboarding/types/user-onboarding-schema.ts"

const prisma = new PrismaClient()
const rollback = new Error("ROLLBACK_USER_ONBOARDING_UAT")

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex")
}

async function main() {
  let checks = 0
  const roleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const parsedInvite = inviteUserSchema.parse({
    name: "  Alex   Morgan  ",
    email: "  Alex.Morgan@Example.COM ",
    roleIds: [roleId, roleId],
  })
  assert.equal(parsedInvite.name, "Alex Morgan")
  assert.equal(parsedInvite.email, "alex.morgan@example.com")
  assert.deepEqual(parsedInvite.roleIds, [roleId])
  checks += 3

  assert.equal(inviteUserSchema.safeParse({ ...parsedInvite, roleIds: [] }).success, false)
  assert.equal(passwordSchema.safeParse("short-pass").success, false)
  assert.equal(passwordSchema.safeParse("long unique passphrase").success, true)
  assert.equal(
    activateAccountSchema.safeParse({
      token: randomBytes(32).toString("base64url"),
      password: "long unique passphrase",
      confirmPassword: "different passphrase",
    }).success,
    false
  )
  assert.equal(invitationTokenSchema.safeParse("not-a-token").success, false)
  checks += 5

  const [baselineUsers, baselineInvitations, baselineAssignments] = await Promise.all([
    prisma.user.count(),
    prisma.userInvitation.count(),
    prisma.userRole.count(),
  ])
  const [administrator, role] = await Promise.all([
    prisma.user.findFirst({
      where: {
        status: "ACTIVE",
        roleAssignments: { some: { role: { key: "SYSTEM_ADMIN", isActive: true } } },
      },
      select: { id: true },
    }),
    prisma.role.findFirst({
      where: { key: "WAREHOUSE_INVENTORY", isActive: true },
      select: { id: true, key: true },
    }),
  ])
  if (!administrator || !role) {
    throw new Error("User onboarding UAT requires an active System Administrator and Warehouse role.")
  }

  const password = `UAT-${randomBytes(18).toString("base64url")}!`
  const passwordHash = await bcrypt.hash(password, 12)
  const firstToken = randomBytes(32).toString("base64url")
  const secondToken = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const normalizedEmail = `uat-onboarding-${Date.now()}@example.com`

  try {
    await prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: "UAT Onboarding User",
            email: normalizedEmail,
            normalizedEmail,
            password: null,
            role: role.key,
            status: "INVITED",
            roleAssignments: {
              create: { roleId: role.id, assignedById: administrator.id },
            },
            invitations: {
              create: {
                tokenHash: tokenHash(firstToken),
                expiresAt,
                createdById: administrator.id,
              },
            },
          },
          select: {
            id: true,
            status: true,
            password: true,
            roleAssignments: true,
            invitations: true,
          },
        })
        assert.equal(user.status, "INVITED")
        assert.equal(user.password, null)
        assert.equal(user.roleAssignments.length, 1)
        assert.equal(user.invitations.length, 1)
        checks += 4

        const revoked = await transaction.userInvitation.updateMany({
          where: { userId: user.id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        })
        assert.equal(revoked.count, 1)
        await transaction.userInvitation.create({
          data: {
            userId: user.id,
            tokenHash: tokenHash(secondToken),
            expiresAt,
            createdById: administrator.id,
          },
        })
        const firstInvitation = await transaction.userInvitation.findUniqueOrThrow({
          where: { tokenHash: tokenHash(firstToken) },
          select: { revokedAt: true },
        })
        assert.ok(firstInvitation.revokedAt)
        checks += 2

        const invitation = await transaction.userInvitation.findUniqueOrThrow({
          where: { tokenHash: tokenHash(secondToken) },
          select: { id: true, userId: true },
        })
        const consumed = await transaction.userInvitation.updateMany({
          where: {
            id: invitation.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        })
        assert.equal(consumed.count, 1)
        const activated = await transaction.user.updateMany({
          where: { id: invitation.userId, status: "INVITED" },
          data: {
            password: passwordHash,
            status: "ACTIVE",
            authVersion: { increment: 1 },
          },
        })
        assert.equal(activated.count, 1)
        const activeUser = await transaction.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { status: true, password: true, authVersion: true },
        })
        assert.equal(activeUser.status, "ACTIVE")
        assert.ok(activeUser.password)
        assert.equal(await bcrypt.compare(password, activeUser.password), true)
        assert.equal(activeUser.authVersion, 2)
        const secondConsumption = await transaction.userInvitation.updateMany({
          where: { id: invitation.id, usedAt: null },
          data: { usedAt: new Date() },
        })
        assert.equal(secondConsumption.count, 0)
        checks += 7

        throw rollback
      },
      { isolationLevel: "Serializable", timeout: 30_000 }
    )
  } catch (error) {
    if (error !== rollback) throw error
  }

  const [finalUsers, finalInvitations, finalAssignments] = await Promise.all([
    prisma.user.count(),
    prisma.userInvitation.count(),
    prisma.userRole.count(),
  ])
  assert.deepEqual(
    [finalUsers, finalInvitations, finalAssignments],
    [baselineUsers, baselineInvitations, baselineAssignments],
    "UAT records must be rolled back"
  )
  checks += 1

  console.log(`User onboarding UAT passed (${checks} checks; database records rolled back).`)
}

main()
  .catch((error) => {
    console.error("User onboarding UAT failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
