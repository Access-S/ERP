-- Prevent Product codes that differ only by case or whitespace.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "products"
    GROUP BY UPPER(REGEXP_REPLACE(BTRIM("product_code"), '[[:space:]]+', ' ', 'g'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce normalized Product-code uniqueness: duplicates exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "products_normalized_code_key"
  ON "products" (UPPER(REGEXP_REPLACE(BTRIM("product_code"), '[[:space:]]+', ' ', 'g')));

COMMENT ON INDEX "products_normalized_code_key" IS
  'Prevents Product codes that differ only by case or repeated whitespace';
