-- The application permits at most one operational and one editable revision
-- for each Product. Archived revisions remain unlimited history.
CREATE UNIQUE INDEX "boms_one_active_revision_per_product"
ON "boms" ("product_id")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "boms_one_draft_revision_per_product"
ON "boms" ("product_id")
WHERE "status" = 'DRAFT';
