import { randomBytes } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { PrismaClient, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import {
  SYSTEM_ROLES,
  type RoleKey,
} from "../src/features/auth/config/authorization-registry.ts"

const prisma = new PrismaClient()
const credentialsPath = resolve(
  process.cwd(),
  "Data files",
  "uat-role-credentials.json"
)

const accountSlugs: Record<RoleKey, string> = {
  EXECUTIVE_GENERAL_MANAGER: "executive-manager",
  OPERATIONS_MANAGER: "operations-manager",
  SALES_CUSTOMER_SERVICE: "sales-service",
  PRODUCTION_PLANNER: "production-planner",
  PROCUREMENT_PURCHASING: "purchasing",
  WAREHOUSE_INVENTORY: "warehouse",
  PRODUCTION_SUPERVISOR: "production-supervisor",
  PRODUCTION_OPERATOR_TEAM_LEADER: "production-operator",
  QUALITY_CONTROL: "quality-control",
  FINANCE_ACCOUNTS: "finance-accounts",
  SYSTEM_ADMIN: "system-admin",
}

type UatCredential = {
  roleKey: RoleKey
  additionalRoleKeys?: RoleKey[]
  roleName: string
  name: string
  email: string
  password: string
}

type UatCredentialsFile = {
  warning: string
  generatedAt: string
  accounts: UatCredential[]
}

function expectedEmail(roleKey: RoleKey): string {
  return `uat.${accountSlugs[roleKey]}@example.com`
}

function generatePassword(): string {
  return `${randomBytes(18).toString("base64url")}!Aa1`
}

function isRoleKey(value: unknown): value is RoleKey {
  return SYSTEM_ROLES.some((role) => role.key === value)
}

function loadExistingCredentials(): UatCredentialsFile | null {
  if (!existsSync(credentialsPath)) return null

  const parsed: unknown = JSON.parse(readFileSync(credentialsPath, "utf8"))
  if (!parsed || typeof parsed !== "object" || !("accounts" in parsed)) {
    throw new Error(`Invalid credentials file: ${credentialsPath}`)
  }

  const candidate = parsed as Partial<UatCredentialsFile>
  if (!Array.isArray(candidate.accounts)) {
    throw new Error(`Invalid accounts list in credentials file: ${credentialsPath}`)
  }

  for (const account of candidate.accounts) {
    if (
      !account ||
      !isRoleKey(account.roleKey) ||
      (account.additionalRoleKeys !== undefined &&
        (!Array.isArray(account.additionalRoleKeys) ||
          account.additionalRoleKeys.some((roleKey) => !isRoleKey(roleKey)))) ||
      typeof account.email !== "string" ||
      typeof account.password !== "string" ||
      account.password.length < 12
    ) {
      throw new Error(`Invalid account entry in credentials file: ${credentialsPath}`)
    }
  }

  return candidate as UatCredentialsFile
}

function buildCredentials(rotatePasswords: boolean): UatCredentialsFile {
  const existing = loadExistingCredentials()
  const existingByEmail = new Map(
    existing?.accounts.map((account) => [account.email, account]) ?? []
  )

  const accounts = SYSTEM_ROLES.map((role): UatCredential => {
    const email = expectedEmail(role.key)
    const previous = existingByEmail.get(email)

    return {
      roleKey: role.key,
      roleName: role.name,
      name: `[UAT] ${role.name}`,
      email,
      password:
        previous && !rotatePasswords ? previous.password : generatePassword(),
    }
  })

  const combinedEmail = "uat.sales-finance@example.com"
  const previousCombined = existingByEmail.get(combinedEmail)
  accounts.push({
    roleKey: "SALES_CUSTOMER_SERVICE",
    additionalRoleKeys: ["FINANCE_ACCOUNTS"],
    roleName: "Sales / Customer Service + Finance / Accounts",
    name: "[UAT] Sales + Finance",
    email: combinedEmail,
    password:
      previousCombined && !rotatePasswords
        ? previousCombined.password
        : generatePassword(),
  })

  const credentials: UatCredentialsFile = {
    warning:
      "Development-only credentials. Keep this file local and never commit or reuse these passwords.",
    generatedAt: new Date().toISOString(),
    accounts,
  }

  mkdirSync(dirname(credentialsPath), { recursive: true })
  writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })

  return credentials
}

async function main() {
  if (!process.argv.includes("--confirm-development")) {
    throw new Error(
      "Refusing to create UAT users without --confirm-development. Run only against the development database."
    )
  }

  const rotatePasswords = process.argv.includes("--rotate-passwords")
  const credentials = buildCredentials(rotatePasswords)
  const passwordHashes = new Map(
    await Promise.all(
      credentials.accounts.map(async (account) => [
        account.email,
        await bcrypt.hash(account.password, 12),
      ] as const)
    )
  )

  const results = await prisma.$transaction(async (tx) => {
    const roles = await tx.role.findMany({
      where: {
        key: { in: SYSTEM_ROLES.map((role) => role.key) },
        isActive: true,
      },
      select: { id: true, key: true },
    })
    const rolesByKey = new Map(roles.map((role) => [role.key, role.id]))

    if (roles.length !== SYSTEM_ROLES.length) {
      const missing = SYSTEM_ROLES
        .map((role) => role.key)
        .filter((key) => !rolesByKey.has(key))
      throw new Error(
        `Missing active roles: ${missing.join(", ")}. Run npm run seed:auth first.`
      )
    }

    const provisioned: Array<{
      role: string
      email: string
      result: "created" | "reset"
    }> = []

    for (const account of credentials.accounts) {
      const assignedRoleKeys = [
        account.roleKey,
        ...(account.additionalRoleKeys ?? []),
      ]
      const roleIds = assignedRoleKeys.map((roleKey) => rolesByKey.get(roleKey))
      const password = passwordHashes.get(account.email)
      if (roleIds.some((roleId) => !roleId) || !password) {
        throw new Error(`Provisioning data is incomplete for ${account.roleKey}`)
      }
      const assignedRoleIds = roleIds as string[]

      const existingUser = await tx.user.findUnique({
        where: { normalizedEmail: account.email },
        select: { id: true, name: true },
      })

      if (existingUser && !existingUser.name.startsWith("[UAT] ")) {
        throw new Error(
          `Refusing to replace non-UAT user using reserved email ${account.email}`
        )
      }

      if (!existingUser) {
        await tx.user.create({
          data: {
            email: account.email,
            normalizedEmail: account.email,
            password,
            name: account.name,
            role: account.roleKey,
            status: UserStatus.ACTIVE,
            roleAssignments: {
              create: assignedRoleIds.map((roleId) => ({ roleId })),
            },
          },
        })
        provisioned.push({
          role: account.roleName,
          email: account.email,
          result: "created",
        })
        continue
      }

      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          email: account.email,
          normalizedEmail: account.email,
          password,
          name: account.name,
          role: account.roleKey,
          status: UserStatus.ACTIVE,
          authVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      })
      await tx.userRole.deleteMany({ where: { userId: existingUser.id } })
      await tx.userRole.createMany({
        data: assignedRoleIds.map((roleId) => ({
          userId: existingUser.id,
          roleId,
        })),
      })
      provisioned.push({
        role: account.roleName,
        email: account.email,
        result: "reset",
      })
    }

    return provisioned
  }, { timeout: 30_000 })

  console.table(results)
  console.log(`Credentials saved locally to: ${credentialsPath}`)
  console.log("Passwords were intentionally omitted from terminal output.")
}

main()
  .catch((error) => {
    console.error("UAT user provisioning failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
