-- Prevent Customer codes that differ only by case or whitespace.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "customers"
    GROUP BY UPPER(REGEXP_REPLACE(BTRIM("customer_code"), '[[:space:]]+', ' ', 'g'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce normalized Customer-code uniqueness: duplicates exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "customers_normalized_code_key"
  ON "customers" (UPPER(REGEXP_REPLACE(BTRIM("customer_code"), '[[:space:]]+', ' ', 'g')));

COMMENT ON INDEX "customers_normalized_code_key" IS
  'Prevents Customer codes that differ only by case or repeated whitespace';
