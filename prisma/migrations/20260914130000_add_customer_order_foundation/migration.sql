-- CreateEnum
CREATE TYPE "CustomerOrderType" AS ENUM ('STANDARD', 'BLANKET');

-- CreateEnum
CREATE TYPE "CustomerOrderStatus" AS ENUM ('DRAFT', 'PO_CHECK', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerOrderReleaseStatus" AS ENUM ('DRAFT', 'PO_CHECK', 'READY_FOR_PLANNING', 'PLANNING', 'PLANNED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerOrderUom" AS ENUM ('UNIT', 'SHIPPER');

-- CreateEnum
CREATE TYPE "CustomerOrderLineValidationStatus" AS ENUM ('VALID', 'PO_CHECK');

-- CreateTable
CREATE TABLE "customer_order_settings" (
    "id" VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
    "price_tolerance_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "currency_decimal_places" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_number_counters" (
    "key" VARCHAR(40) NOT NULL,
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_number_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "customer_purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "internal_order_number" VARCHAR(40) NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "CustomerOrderType" NOT NULL,
    "customer_po_number" VARCHAR(100) NOT NULL,
    "original_authorized_value" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'AUD',
    "received_date" DATE NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_amendments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_purchase_order_id" UUID NOT NULL,
    "value_delta" DECIMAL(19,2) NOT NULL,
    "previous_authorized_value" DECIMAL(19,2) NOT NULL,
    "resulting_authorized_value" DECIMAL(19,2) NOT NULL,
    "customer_reference" VARCHAR(100),
    "received_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "reason" VARCHAR(500),
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_purchase_order_id" UUID NOT NULL,
    "internal_release_number" VARCHAR(40) NOT NULL,
    "customer_release_reference" VARCHAR(100),
    "received_date" DATE NOT NULL,
    "default_requested_delivery_date" DATE,
    "customer_net_total" DECIMAL(19,2),
    "expected_net_total" DECIMAL(19,2),
    "variance_amount" DECIMAL(19,2),
    "variance_percentage" DECIMAL(9,4),
    "tolerance_percentage_snapshot" DECIMAL(7,4),
    "validation_issues" JSONB NOT NULL DEFAULT '[]',
    "status" "CustomerOrderReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "committed_value" DECIMAL(19,2),
    "committed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "last_validated_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_release_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "release_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "bom_id" UUID,
    "product_code_snapshot" VARCHAR(100) NOT NULL,
    "product_description_snapshot" VARCHAR(500),
    "ordered_quantity" DECIMAL(19,6) NOT NULL,
    "order_uom" "CustomerOrderUom" NOT NULL,
    "requested_delivery_date" DATE NOT NULL,
    "units_per_shipper_snapshot" INTEGER NOT NULL,
    "price_per_shipper_snapshot" DECIMAL(19,4) NOT NULL,
    "calculated_shippers" DECIMAL(19,6) NOT NULL,
    "customer_line_value" DECIMAL(19,2) NOT NULL,
    "expected_line_value" DECIMAL(19,2) NOT NULL,
    "variance_amount" DECIMAL(19,2) NOT NULL,
    "variance_percentage" DECIMAL(9,4) NOT NULL,
    "validation_status" "CustomerOrderLineValidationStatus" NOT NULL DEFAULT 'PO_CHECK',
    "validation_issues" JSONB NOT NULL DEFAULT '[]',
    "legacy_purchase_order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_release_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_release_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "release_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_reason" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_release_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_email_snapshot" VARCHAR(254),
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "business_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_purchase_orders_internal_order_number_key" ON "customer_purchase_orders"("internal_order_number");

-- CreateIndex
CREATE INDEX "customer_purchase_orders_customer_id_status_idx" ON "customer_purchase_orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "customer_purchase_orders_type_status_idx" ON "customer_purchase_orders"("type", "status");

-- CreateIndex
CREATE INDEX "customer_purchase_orders_valid_to_idx" ON "customer_purchase_orders"("valid_to");

-- CreateIndex
CREATE INDEX "customer_purchase_orders_created_by_id_idx" ON "customer_purchase_orders"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_purchase_orders_customer_id_customer_po_number_key" ON "customer_purchase_orders"("customer_id", "customer_po_number");

-- CreateIndex
CREATE INDEX "customer_order_amendments_customer_purchase_order_id_create_idx" ON "customer_order_amendments"("customer_purchase_order_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_order_amendments_recorded_by_id_idx" ON "customer_order_amendments"("recorded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_releases_internal_release_number_key" ON "customer_order_releases"("internal_release_number");

-- CreateIndex
CREATE INDEX "customer_order_releases_customer_purchase_order_id_status_idx" ON "customer_order_releases"("customer_purchase_order_id", "status");

-- CreateIndex
CREATE INDEX "customer_order_releases_status_received_date_idx" ON "customer_order_releases"("status", "received_date");

-- CreateIndex
CREATE INDEX "customer_order_releases_created_by_id_idx" ON "customer_order_releases"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_release_lines_legacy_purchase_order_id_key" ON "customer_order_release_lines"("legacy_purchase_order_id");

-- CreateIndex
CREATE INDEX "customer_order_release_lines_product_id_idx" ON "customer_order_release_lines"("product_id");

-- CreateIndex
CREATE INDEX "customer_order_release_lines_bom_id_idx" ON "customer_order_release_lines"("bom_id");

-- CreateIndex
CREATE INDEX "customer_order_release_lines_requested_delivery_date_idx" ON "customer_order_release_lines"("requested_delivery_date");

-- CreateIndex
CREATE INDEX "customer_order_release_lines_validation_status_idx" ON "customer_order_release_lines"("validation_status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_release_lines_release_id_position_key" ON "customer_order_release_lines"("release_id", "position");

-- CreateIndex
CREATE INDEX "customer_order_release_revisions_created_by_id_idx" ON "customer_order_release_revisions"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_release_revisions_release_id_revision_key" ON "customer_order_release_revisions"("release_id", "revision");

-- CreateIndex
CREATE INDEX "business_audit_events_occurred_at_idx" ON "business_audit_events"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "business_audit_events_event_type_occurred_at_idx" ON "business_audit_events"("event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "business_audit_events_actor_user_id_occurred_at_idx" ON "business_audit_events"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "business_audit_events_target_type_target_id_occurred_at_idx" ON "business_audit_events"("target_type", "target_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "business_audit_events_correlation_id_idx" ON "business_audit_events"("correlation_id");

-- AddForeignKey
ALTER TABLE "customer_purchase_orders" ADD CONSTRAINT "customer_purchase_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_purchase_orders" ADD CONSTRAINT "customer_purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_amendments" ADD CONSTRAINT "customer_order_amendments_customer_purchase_order_id_fkey" FOREIGN KEY ("customer_purchase_order_id") REFERENCES "customer_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_amendments" ADD CONSTRAINT "customer_order_amendments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_releases" ADD CONSTRAINT "customer_order_releases_customer_purchase_order_id_fkey" FOREIGN KEY ("customer_purchase_order_id") REFERENCES "customer_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_releases" ADD CONSTRAINT "customer_order_releases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_lines" ADD CONSTRAINT "customer_order_release_lines_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "customer_order_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_lines" ADD CONSTRAINT "customer_order_release_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_lines" ADD CONSTRAINT "customer_order_release_lines_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_lines" ADD CONSTRAINT "customer_order_release_lines_legacy_purchase_order_id_fkey" FOREIGN KEY ("legacy_purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_revisions" ADD CONSTRAINT "customer_order_release_revisions_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "customer_order_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_release_revisions" ADD CONSTRAINT "customer_order_release_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Commercial configuration is deliberately strict until an authorised user
-- chooses a tolerance. Percent is stored as a human percentage (1 = 1%).
ALTER TABLE "customer_order_settings"
ADD CONSTRAINT "customer_order_settings_tolerance_range"
CHECK ("price_tolerance_percent" >= 0 AND "price_tolerance_percent" <= 100),
ADD CONSTRAINT "customer_order_settings_currency_decimals_range"
CHECK ("currency_decimal_places" BETWEEN 0 AND 4);

ALTER TABLE "customer_order_number_counters"
ADD CONSTRAINT "customer_order_number_counters_non_negative"
CHECK ("last_sequence" >= 0);

ALTER TABLE "customer_purchase_orders"
ADD CONSTRAINT "customer_purchase_orders_reference_not_blank"
CHECK (length(btrim("customer_po_number")) > 0),
ADD CONSTRAINT "customer_purchase_orders_internal_number_not_blank"
CHECK (length(btrim("internal_order_number")) > 0),
ADD CONSTRAINT "customer_purchase_orders_currency_uppercase"
CHECK ("currency" = upper("currency")),
ADD CONSTRAINT "customer_purchase_orders_authority_non_negative"
CHECK ("original_authorized_value" >= 0),
ADD CONSTRAINT "customer_purchase_orders_valid_date_order"
CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from"),
ADD CONSTRAINT "customer_purchase_orders_active_blanket_complete"
CHECK (
  "type" <> 'BLANKET'
  OR "status" IN ('DRAFT', 'PO_CHECK', 'CANCELLED')
  OR (
    "original_authorized_value" > 0
    AND "valid_from" IS NOT NULL
    AND "valid_to" IS NOT NULL
  )
);

ALTER TABLE "customer_order_amendments"
ADD CONSTRAINT "customer_order_amendments_positive_top_up"
CHECK ("value_delta" > 0),
ADD CONSTRAINT "customer_order_amendments_value_chain"
CHECK (
  "previous_authorized_value" >= 0
  AND "resulting_authorized_value" = "previous_authorized_value" + "value_delta"
);

ALTER TABLE "customer_order_releases"
ADD CONSTRAINT "customer_order_releases_internal_number_not_blank"
CHECK (length(btrim("internal_release_number")) > 0),
ADD CONSTRAINT "customer_order_releases_revision_positive"
CHECK ("revision_number" > 0),
ADD CONSTRAINT "customer_order_releases_values_non_negative"
CHECK (
  ("customer_net_total" IS NULL OR "customer_net_total" >= 0)
  AND ("expected_net_total" IS NULL OR "expected_net_total" >= 0)
  AND ("variance_amount" IS NULL OR "variance_amount" >= 0)
  AND ("variance_percentage" IS NULL OR "variance_percentage" >= 0)
  AND ("tolerance_percentage_snapshot" IS NULL OR ("tolerance_percentage_snapshot" >= 0 AND "tolerance_percentage_snapshot" <= 100))
  AND ("committed_value" IS NULL OR "committed_value" >= 0)
),
ADD CONSTRAINT "customer_order_releases_commitment_complete"
CHECK (
  "status" NOT IN ('READY_FOR_PLANNING', 'PLANNING', 'PLANNED', 'IN_PRODUCTION', 'COMPLETED')
  OR ("committed_value" IS NOT NULL AND "committed_at" IS NOT NULL)
);

ALTER TABLE "customer_order_release_lines"
ADD CONSTRAINT "customer_order_release_lines_position_positive"
CHECK ("position" > 0),
ADD CONSTRAINT "customer_order_release_lines_values_valid"
CHECK (
  "ordered_quantity" > 0
  AND "units_per_shipper_snapshot" > 0
  AND "price_per_shipper_snapshot" > 0
  AND "calculated_shippers" > 0
  AND "customer_line_value" >= 0
  AND "expected_line_value" >= 0
  AND "variance_amount" >= 0
  AND "variance_percentage" >= 0
);

ALTER TABLE "customer_order_release_revisions"
ADD CONSTRAINT "customer_order_release_revisions_revision_positive"
CHECK ("revision" > 0);

INSERT INTO "customer_order_settings" (
  "id",
  "price_tolerance_percent",
  "currency_decimal_places"
) VALUES ('DEFAULT', 0, 2)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "customer_order_number_counters" ("key", "last_sequence")
VALUES ('CUSTOMER_ORDER', 0), ('CUSTOMER_RELEASE', 0)
ON CONFLICT ("key") DO NOTHING;

-- Customer-order amendments and release revisions are evidence. They may be
-- inserted and rolled back in a transaction, but never rewritten or deleted.
CREATE FUNCTION "reject_business_history_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'business history records are append-only';
END;
$$;

CREATE TRIGGER "customer_order_amendments_append_only"
BEFORE UPDATE OR DELETE ON "customer_order_amendments"
FOR EACH ROW EXECUTE FUNCTION "reject_business_history_mutation"();

CREATE TRIGGER "customer_order_release_revisions_append_only"
BEFORE UPDATE OR DELETE ON "customer_order_release_revisions"
FOR EACH ROW EXECUTE FUNCTION "reject_business_history_mutation"();

CREATE TRIGGER "business_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "business_audit_events"
FOR EACH ROW EXECUTE FUNCTION "reject_business_history_mutation"();
