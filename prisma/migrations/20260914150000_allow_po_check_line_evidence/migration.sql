-- A PO Check line must retain what Customer Service entered even when trusted
-- Product planning data is incomplete. Valid lines remain fully constrained.
ALTER TABLE "customer_order_release_lines"
ALTER COLUMN "requested_delivery_date" DROP NOT NULL,
ALTER COLUMN "units_per_shipper_snapshot" DROP NOT NULL,
ALTER COLUMN "price_per_shipper_snapshot" DROP NOT NULL,
ALTER COLUMN "calculated_shippers" DROP NOT NULL,
ALTER COLUMN "expected_line_value" DROP NOT NULL,
ALTER COLUMN "variance_amount" DROP NOT NULL,
ALTER COLUMN "variance_percentage" DROP NOT NULL;

ALTER TABLE "customer_order_release_lines"
DROP CONSTRAINT "customer_order_release_lines_values_valid";

ALTER TABLE "customer_order_release_lines"
ADD CONSTRAINT "customer_order_release_lines_values_valid"
CHECK (
  "ordered_quantity" > 0
  AND "customer_line_value" >= 0
  AND ("units_per_shipper_snapshot" IS NULL OR "units_per_shipper_snapshot" > 0)
  AND ("price_per_shipper_snapshot" IS NULL OR "price_per_shipper_snapshot" > 0)
  AND ("calculated_shippers" IS NULL OR "calculated_shippers" > 0)
  AND ("expected_line_value" IS NULL OR "expected_line_value" >= 0)
  AND ("variance_amount" IS NULL OR "variance_amount" >= 0)
  AND ("variance_percentage" IS NULL OR "variance_percentage" >= 0)
  AND (
    "validation_status" <> 'VALID'
    OR (
      "bom_id" IS NOT NULL
      AND "requested_delivery_date" IS NOT NULL
      AND "units_per_shipper_snapshot" IS NOT NULL
      AND "price_per_shipper_snapshot" IS NOT NULL
      AND "calculated_shippers" IS NOT NULL
      AND "expected_line_value" IS NOT NULL
      AND "variance_amount" IS NOT NULL
      AND "variance_percentage" IS NOT NULL
    )
  )
);
