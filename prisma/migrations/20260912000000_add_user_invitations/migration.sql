-- Invited accounts do not have a password until the invitation holder sets one.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invitations_token_hash_key"
ON "user_invitations"("token_hash");

-- The service revokes an existing open invitation before issuing another. This
-- partial unique index also protects that invariant during concurrent requests.
CREATE UNIQUE INDEX "user_invitations_one_open_per_user"
ON "user_invitations"("user_id")
WHERE "used_at" IS NULL AND "revoked_at" IS NULL;

CREATE INDEX "user_invitations_user_id_idx"
ON "user_invitations"("user_id");

CREATE INDEX "user_invitations_expires_at_idx"
ON "user_invitations"("expires_at");

CREATE INDEX "user_invitations_created_by_id_idx"
ON "user_invitations"("created_by_id");

ALTER TABLE "user_invitations"
ADD CONSTRAINT "user_invitations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invitations"
ADD CONSTRAINT "user_invitations_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
