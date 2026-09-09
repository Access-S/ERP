import { PrismaClient, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

function requireEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function main() {
  const email = requireEnvironmentValue("BOOTSTRAP_ADMIN_EMAIL").toLowerCase()
  const password = requireEnvironmentValue("BOOTSTRAP_ADMIN_PASSWORD")
  const name = requireEnvironmentValue("BOOTSTRAP_ADMIN_NAME")

  if (!email.includes("@")) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address")
  }
  if (password.length < 12) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters"
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const systemAdminRole = await tx.role.findUnique({
      where: { key: "SYSTEM_ADMIN" },
      select: { id: true },
    })
    if (!systemAdminRole) {
      throw new Error("SYSTEM_ADMIN is not seeded. Run npm run seed:auth first.")
    }

    const existingUser = await tx.user.findUnique({
      where: { normalizedEmail: email },
      select: {
        id: true,
        roleAssignments: {
          where: { roleId: systemAdminRole.id },
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
      return { id: existingUser.id, created: false }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await tx.user.create({
      data: {
        email,
        normalizedEmail: email,
        password: passwordHash,
        name,
        role: "ADMIN",
        status: UserStatus.ACTIVE,
        roleAssignments: {
          create: { roleId: systemAdminRole.id },
        },
      },
      select: { id: true },
    })

    return { id: user.id, created: true }
  })

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
