-- Required by the trigram GIN indexes below on a fresh PostgreSQL database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "addresses" (
    "unit_number" TEXT,
    "street_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "latitude" DECIMAL,
    "longitude" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID,
    "part_code" TEXT NOT NULL,
    "part_description" TEXT,
    "part_type" TEXT,
    "per_shipper" DECIMAL,

    CONSTRAINT "bom_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_billing_addresses" (
    "customer_id" UUID NOT NULL,
    "address_id" UUID NOT NULL,

    CONSTRAINT "customer_billing_addresses_pkey" PRIMARY KEY ("customer_id","address_id")
);

-- CreateTable
CREATE TABLE "customer_shipping_addresses" (
    "customer_id" UUID NOT NULL,
    "address_id" UUID NOT NULL,

    CONSTRAINT "customer_shipping_addresses_pkey" PRIMARY KEY ("customer_id","address_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "tax_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "customer_type" TEXT NOT NULL DEFAULT 'STANDARD',
    "industry" TEXT,
    "payment_terms" TEXT,
    "credit_limit" DECIMAL NOT NULL DEFAULT 0,
    "credit_rating" TEXT,
    "last_credit_review_date" TIMESTAMPTZ(6),
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "default_discount_percentage" DECIMAL NOT NULL DEFAULT 0,
    "accounts_receivable_code" TEXT,
    "is_tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "tax_exempt_certificate_number" TEXT,
    "sales_territory" TEXT,
    "default_shipping_method" TEXT,
    "shipping_carrier_account" TEXT,
    "lead_time_days" INTEGER,
    "delivery_window_start" TEXT,
    "delivery_window_end" TEXT,
    "pallet_preference" TEXT,
    "pallet_account_number" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_email" TEXT,
    "primary_contact_phone" TEXT,
    "accounts_payables_email" TEXT,
    "delivery_contact_phone" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" BIGSERIAL NOT NULL,
    "forecast_date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "product_code" TEXT,
    "description" TEXT,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_counters" (
    "customer_name" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "po_counters_pkey" PRIMARY KEY ("customer_name")
);

-- CreateTable
CREATE TABLE "po_status_history" (
    "id" BIGSERIAL NOT NULL,
    "po_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_code" TEXT NOT NULL,
    "description" TEXT,
    "units_per_shipper" INTEGER,
    "daily_run_rate" DECIMAL,
    "hourly_run_rate" DECIMAL,
    "mins_per_shipper" DECIMAL,
    "price_per_shipper" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "customer_id" UUID,
    "uom" TEXT NOT NULL DEFAULT 'Each',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "product_id" UUID,
    "customer_name" TEXT NOT NULL,
    "po_created_date" DATE,
    "po_received_date" DATE,
    "requested_delivery_date" DATE,
    "ordered_qty_pieces" INTEGER NOT NULL,
    "ordered_qty_shippers" DECIMAL NOT NULL,
    "customer_amount" DECIMAL NOT NULL,
    "system_amount" DECIMAL NOT NULL,
    "current_status" TEXT NOT NULL DEFAULT 'Open',
    "delivery_date" DATE,
    "delivery_docket_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "hourly_run_rate" DECIMAL,
    "mins_per_shipper" DECIMAL,
    "customer_id" UUID,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soh" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "import_batch_id" UUID DEFAULT gen_random_uuid(),
    "import_source" TEXT DEFAULT 'manual_upload',
    "description" TEXT,
    "stock_on_hand" DECIMAL,
    "default_uom" TEXT,
    "locations" TEXT,
    "ean" TEXT,
    "weight_kg" DECIMAL,
    "volume_m3" DECIMAL,

    CONSTRAINT "soh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WAREHOUSE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bom_components_product_id" ON "bom_components"("product_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code" ASC);

-- CreateIndex
CREATE INDEX "idx_product_search" ON "products" USING GIN ("product_code" gin_trgm_ops ASC, "description" gin_trgm_ops ASC);

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code" ASC);

-- CreateIndex
CREATE INDEX "idx_po_customer_id" ON "purchase_orders"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "idx_po_product_id" ON "purchase_orders"("product_id" ASC);

-- CreateIndex
CREATE INDEX "idx_po_search" ON "purchase_orders" USING GIN ("po_number" gin_trgm_ops ASC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_created_at" ON "soh"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_ean" ON "soh"("ean" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_import_batch_id" ON "soh"("import_batch_id" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_product_id" ON "soh"("product_id" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_product_id_text" ON "soh"("product_id" ASC);

-- CreateIndex
CREATE INDEX "idx_soh_stock_on_hand" ON "soh"("stock_on_hand" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_billing_addresses" ADD CONSTRAINT "customer_billing_addresses_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_billing_addresses" ADD CONSTRAINT "customer_billing_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_shipping_addresses" ADD CONSTRAINT "customer_shipping_addresses_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_shipping_addresses" ADD CONSTRAINT "customer_shipping_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_status_history" ADD CONSTRAINT "po_status_history_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Preserve the row-level-security configuration discovered on the existing database.
ALTER TABLE "soh" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on soh" ON "soh" AS PERMISSIVE FOR ALL TO PUBLIC USING (true);
