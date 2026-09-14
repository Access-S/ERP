import { z } from "zod"
import { sensitiveChangeReasonSchema } from "../src/features/security-audit/types/sensitive-change-reason.ts"

const environmentSchema = z.enum(["development", "staging", "production"])
const normalizedEmailSchema = z
  .string()
  .trim()
  .max(254, "BOOTSTRAP_ADMIN_EMAIL is too long")
  .email("BOOTSTRAP_ADMIN_EMAIL must be a valid email address")
  .transform((value) => value.toLowerCase())
const nameSchema = z
  .string()
  .trim()
  .min(2, "BOOTSTRAP_ADMIN_NAME must contain at least 2 characters")
  .max(100, "BOOTSTRAP_ADMIN_NAME cannot exceed 100 characters")
  .transform((value) => value.replace(/\s+/g, " "))
const passwordSchema = z
  .string()
  .min(12, "BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters")
  .max(128, "BOOTSTRAP_ADMIN_PASSWORD is too long")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "BOOTSTRAP_ADMIN_PASSWORD cannot exceed 72 UTF-8 bytes"
  )

function requiredValue(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid bootstrap input")
  }
  return result.data
}

export function resolveBootstrapAdminConfig(
  environment: NodeJS.ProcessEnv,
  argv: readonly string[]
) {
  const deploymentEnvironment = parseOrThrow(
    environmentSchema,
    requiredValue(environment, "BOOTSTRAP_ADMIN_ENVIRONMENT").toLowerCase()
  )
  const confirmationFlag = `--confirm-environment=${deploymentEnvironment}`
  if (!argv.includes(confirmationFlag)) {
    throw new Error(
      `Refusing bootstrap without ${confirmationFlag}. Verify the target environment first.`
    )
  }

  const databaseUrl = requiredValue(environment, "DATABASE_URL")
  let databaseHost: string
  try {
    databaseHost = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL")
  }

  const expectedDatabaseHost = requiredValue(
    environment,
    "BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST"
  ).toLowerCase()
  if (databaseHost !== expectedDatabaseHost) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EXPECTED_DATABASE_HOST does not match the configured database"
    )
  }

  const email = parseOrThrow(
    normalizedEmailSchema,
    requiredValue(environment, "BOOTSTRAP_ADMIN_EMAIL")
  )
  if (email.endsWith("@example.com") || email.endsWith(".example.com")) {
    throw new Error("Reserved example.com addresses cannot be bootstrap administrators")
  }

  const confirmationEmail = parseOrThrow(
    normalizedEmailSchema,
    requiredValue(environment, "BOOTSTRAP_ADMIN_CONFIRM_EMAIL")
  )
  if (email !== confirmationEmail) {
    throw new Error("BOOTSTRAP_ADMIN_CONFIRM_EMAIL must exactly match the administrator email")
  }

  return {
    deploymentEnvironment,
    databaseHost,
    email,
    name: parseOrThrow(
      nameSchema,
      requiredValue(environment, "BOOTSTRAP_ADMIN_NAME")
    ),
    password: parseOrThrow(
      passwordSchema,
      requiredValue(environment, "BOOTSTRAP_ADMIN_PASSWORD")
    ),
    reason: parseOrThrow(
      sensitiveChangeReasonSchema,
      requiredValue(environment, "BOOTSTRAP_ADMIN_REASON")
    ),
  }
}
