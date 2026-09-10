import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const uatEmail = "uat.sales-finance@example.com"
const supportedModes = ["combined", "sales-only"] as const
type Mode = (typeof supportedModes)[number]

function getMode(): Mode {
  const argument = process.argv.find((value) => value.startsWith("--mode="))
  const mode = argument?.slice("--mode=".length)
  if (!supportedModes.includes(mode as Mode)) {
    throw new Error("--mode must be combined or sales-only")
  }
  return mode as Mode
}

async function main() {
  if (!process.argv.includes("--confirm-development")) {
    throw new Error(
      "Refusing to change the UAT scenario without --confirm-development."
    )
  }

  const mode = getMode()
  const desiredRoleKeys =
    mode === "combined"
      ? ["SALES_CUSTOMER_SERVICE", "FINANCE_ACCOUNTS"]
      : ["SALES_CUSTOMER_SERVICE"]

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { normalizedEmail: uatEmail },
      select: { id: true, name: true },
    })
    if (!user || !user.name.startsWith("[UAT] ")) {
      throw new Error(
        `Dedicated UAT user not found. Run npm run provision:uat-users first.`
      )
    }

    const roles = await tx.role.findMany({
      where: { key: { in: desiredRoleKeys }, isActive: true },
      select: { id: true, key: true },
    })
    if (roles.length !== desiredRoleKeys.length) {
      throw new Error("One or more required active roles are missing")
    }

    await tx.userRole.deleteMany({ where: { userId: user.id } })
    await tx.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
    })
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: "SALES_CUSTOMER_SERVICE",
        authVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    })

    return roles.map((role) => role.key).sort()
  })

  console.log(
    JSON.stringify(
      {
        email: uatEmail,
        mode,
        assignedRoles: result,
        existingSessionsInvalidated: true,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error("UAT multi-role scenario configuration failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
