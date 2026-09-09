import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.INSPECT_USER_EMAIL?.trim().toLowerCase()
  if (!email) {
    throw new Error("INSPECT_USER_EMAIL is required")
  }

  const user = await prisma.user.findUnique({
    where: { normalizedEmail: email },
    select: {
      id: true,
      name: true,
      status: true,
      authVersion: true,
      roleAssignments: {
        select: { role: { select: { key: true, isActive: true } } },
        orderBy: { role: { key: "asc" } },
      },
    },
  })

  if (!user) {
    console.log("User not found")
    return
  }

  console.log(JSON.stringify({
    id: user.id,
    name: user.name,
    status: user.status,
    authVersion: user.authVersion,
    roles: user.roleAssignments.map((assignment) => assignment.role),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("User access inspection failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
