BEGIN;

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "default_currency" SET DEFAULT 'AUD';

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "quantity_basis" TEXT NOT NULL DEFAULT 'PER_SHIPPER',
    "effective_from" DATE,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "part_code" TEXT NOT NULL,
    "normalized_code" TEXT NOT NULL,
    "description" TEXT,
    "part_type" TEXT,
    "default_uom" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bom_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "quantity" DECIMAL,
    "uom" TEXT,
    "position" INTEGER,
    "legacy_component_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_lines_pkey" PRIMARY KEY ("id")
);

-- Backfill one canonical Part per normalized legacy part code. The most-used
-- description/type combination wins; ties prefer the more descriptive value.
-- Every original value remains available in bom_components during transition.
WITH "part_candidates" AS (
    SELECT
        UPPER(BTRIM("part_code")) AS "normalized_code",
        BTRIM("part_code") AS "part_code",
        NULLIF(BTRIM("part_description"), '') AS "description",
        NULLIF(BTRIM("part_type"), '') AS "part_type",
        COUNT(*) AS "usage_count"
    FROM "bom_components"
    GROUP BY
        UPPER(BTRIM("part_code")),
        BTRIM("part_code"),
        NULLIF(BTRIM("part_description"), ''),
        NULLIF(BTRIM("part_type"), '')
),
"ranked_parts" AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY "normalized_code"
            ORDER BY
                "usage_count" DESC,
                LENGTH("description") DESC NULLS LAST,
                "description" ASC NULLS LAST,
                "part_code" ASC
        ) AS "candidate_rank"
    FROM "part_candidates"
)
INSERT INTO "parts" (
    "id",
    "part_code",
    "normalized_code",
    "description",
    "part_type",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "part_code",
    "normalized_code",
    "description",
    "part_type",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ranked_parts"
WHERE "candidate_rank" = 1;

-- Backfill one imported revision-1 BOM for each Product that currently owns
-- legacy component rows. Imported BOMs remain ACTIVE; health is calculated
-- separately so existing operational availability is not changed.
INSERT INTO "boms" (
    "id",
    "product_id",
    "revision",
    "status",
    "quantity_basis",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "products"."id",
    1,
    'ACTIVE'::"BomStatus",
    'PER_SHIPPER',
    "products"."created_at",
    "products"."updated_at"
FROM "products"
WHERE EXISTS (
    SELECT 1
    FROM "bom_components"
    WHERE "bom_components"."product_id" = "products"."id"
);

-- Preserve every linked legacy row as its own BOM Line, including duplicate
-- Product/Part rows and zero quantities. Those anomalies are surfaced by the
-- application as health issues instead of being silently merged or discarded.
INSERT INTO "bom_lines" (
    "id",
    "bom_id",
    "part_id",
    "quantity",
    "uom",
    "position",
    "legacy_component_id",
    "created_at",
    "updated_at"
)
SELECT
    "bom_components"."id",
    "boms"."id",
    "parts"."id",
    "bom_components"."per_shipper",
    NULL,
    ROW_NUMBER() OVER (
        PARTITION BY "bom_components"."product_id"
        ORDER BY "bom_components"."part_code", "bom_components"."id"
    )::INTEGER,
    "bom_components"."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "bom_components"
JOIN "boms"
    ON "boms"."product_id" = "bom_components"."product_id"
    AND "boms"."revision" = 1
JOIN "parts"
    ON "parts"."normalized_code" = UPPER(BTRIM("bom_components"."part_code"))
WHERE "bom_components"."product_id" IS NOT NULL;

-- Fail and roll back the migration if the backfill does not preserve the
-- audited one-Part-per-code, one-BOM-per-linked-Product, and one-line-per-row
-- mappings.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "bom_components" WHERE BTRIM("part_code") = ''
    ) THEN
        RAISE EXCEPTION 'Cannot normalize blank legacy part codes';
    END IF;

    IF (SELECT COUNT(*) FROM "parts") <>
       (SELECT COUNT(DISTINCT UPPER(BTRIM("part_code"))) FROM "bom_components") THEN
        RAISE EXCEPTION 'Part backfill count does not match unique legacy part codes';
    END IF;

    IF (SELECT COUNT(*) FROM "boms") <>
       (SELECT COUNT(DISTINCT "product_id") FROM "bom_components" WHERE "product_id" IS NOT NULL) THEN
        RAISE EXCEPTION 'BOM backfill count does not match linked legacy Products';
    END IF;

    IF (SELECT COUNT(*) FROM "bom_lines") <>
       (SELECT COUNT(*) FROM "bom_components" WHERE "product_id" IS NOT NULL) THEN
        RAISE EXCEPTION 'BOM Line backfill did not preserve every linked legacy component row';
    END IF;
END $$;

COMMENT ON TABLE "bom_components" IS 'Legacy BOM source retained during normalized-model transition';
COMMENT ON COLUMN "parts"."normalized_code" IS 'Uppercase trimmed key used for case-insensitive Part-code identity';
COMMENT ON COLUMN "bom_lines"."legacy_component_id" IS 'Trace back to the source bom_components row';

-- CreateIndex
CREATE INDEX "boms_product_id_idx" ON "boms"("product_id");

-- CreateIndex
CREATE INDEX "boms_status_idx" ON "boms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "boms_product_id_revision_key" ON "boms"("product_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "parts_part_code_key" ON "parts"("part_code");

-- CreateIndex
CREATE UNIQUE INDEX "parts_normalized_code_key" ON "parts"("normalized_code");

-- CreateIndex
CREATE INDEX "parts_part_type_idx" ON "parts"("part_type");

-- CreateIndex
CREATE UNIQUE INDEX "bom_lines_legacy_component_id_key" ON "bom_lines"("legacy_component_id");

-- CreateIndex
CREATE INDEX "bom_lines_bom_id_idx" ON "bom_lines"("bom_id");

-- CreateIndex
CREATE INDEX "bom_lines_part_id_idx" ON "bom_lines"("part_id");

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
