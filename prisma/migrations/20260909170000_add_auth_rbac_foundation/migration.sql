-- Additive authentication and authorization foundation.
-- The legacy users.role column remains in place until server authorization and
-- all existing user mappings have been verified in a later migration.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- Refuse to normalize login identifiers if two existing emails would collapse
-- to the same value. This fails before any table changes are made.
DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(BTRIM("email"))
    FROM "users"
    GROUP BY LOWER(BTRIM("email"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize users.email because case-insensitive duplicates exist';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "last_login_at" TIMESTAMPTZ(6),
ADD COLUMN "normalized_email" TEXT,
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "users"
SET "normalized_email" = LOWER(BTRIM("email"));

ALTER TABLE "users"
ALTER COLUMN "normalized_email" SET NOT NULL;

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "permissions_module_idx" ON "permissions"("module");
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "user_roles_assigned_by_id_idx" ON "user_roles"("assigned_by_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- AddForeignKey
ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_assigned_by_id_fkey"
FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
ADD CONSTRAINT "role_permissions_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
