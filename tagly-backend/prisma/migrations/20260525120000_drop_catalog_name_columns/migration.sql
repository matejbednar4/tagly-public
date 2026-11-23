-- Drop `name` columns from the catalog tables.
--
-- The single source of truth for display labels is the @flaer/models catalog,
-- keyed by `slug`. The catalog stores both English and Czech names. The
-- backend constructs the (English) `name` field on API responses by looking
-- up the slug — purely for back-compat with old clients that don't know how
-- to do the lookup themselves. New clients ignore `name` and read the
-- localized label from the catalog by slug.
--
-- Dropping the columns also drops the unique constraints and indexes on them.

BEGIN;

ALTER TABLE app.verticals        DROP COLUMN IF EXISTS name;
ALTER TABLE app.advertiser_types DROP COLUMN IF EXISTS name;
ALTER TABLE app.interests        DROP COLUMN IF EXISTS name;

COMMIT;
