-- Cleanup: the verticals/types/interests catalog moved to @flaer/models and was
-- trimmed dramatically (verticals 16 → 9, advertiser types ~160 → 38,
-- interests ~106 → 22). This migration removes the orphan rows from
-- `app.verticals`, `app.advertiser_types`, `app.interests` plus all M2M join
-- rows that reference them.
--
-- For removed advertiser types: every local / non-local / campaign (and their
-- pending versions) that still points to a removed type gets reassigned to the
-- "other" catch-all type. Owners are NOT notified — single-market dataset, low
-- blast radius. If "other" is missing for any reason the migration aborts.
--
-- For removed interests: customers/pending customers are first REMAPPED from
-- the removed slug onto the closest surviving slug (see step 5.5 below) so
-- the dominant signal (food, beauty, racquet sports, …) is preserved. After
-- the remap, the M2M join rows for the still-removed slugs are deleted, then
-- the orphan interest rows.
--
-- For removed verticals: the catalog only keeps verticals that are referenced
-- by at least one surviving type AND at least one surviving interest. The M2M
-- join rows on `_AdvertiserTypeToVertical` and `_InterestToVertical` are
-- cleaned before the orphan vertical rows are deleted.
--
-- Customer/advertiser type/interest SELECTIONS are preserved: a customer who
-- picked an interest that's still in the catalog keeps it; only the vertical
-- tagging of that interest changes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Keep-list of catalog slugs (kept in sync with shared/models/src/catalogs)
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE _keep_type_slugs(slug TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _keep_type_slugs(slug) VALUES
  ('other'),
  ('restaurant'), ('cafe'), ('juice-smoothie-bar'), ('bakery'),
  ('ice-cream-shop'), ('patisserie'), ('food-truck'), ('brewery'),
  ('winery'), ('bar'), ('shisha-lounge'), ('nightclub'),
  ('thrift-vintage-store'),
  ('hair-salon'), ('tattoo-piercing-studio'), ('barbershop'),
  ('nail-salon'), ('wellness-center'),
  ('gym'), ('yoga-studio'), ('pilates-studio'), ('climbing-gym'),
  ('tennis-court'), ('padel-court'), ('sports-club'),
  ('theater'), ('movie-theater'),
  ('bowling-alley'), ('mini-golf'), ('arcade'), ('escape-room'),
  ('laser-tag'), ('amusement-park'), ('zoo'), ('aquarium'),
  ('pet-services'), ('coworking-space');

CREATE TEMPORARY TABLE _keep_interest_slugs(slug TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _keep_interest_slugs(slug) VALUES
  ('food-dining'), ('cafe-culture'), ('bars-nightlife'), ('beer-wine'),
  ('hair-barbering'), ('beauty-spa'), ('tattoo-piercing'),
  ('gym-fitness'), ('yoga'), ('pilates'), ('climbing'),
  ('tennis'), ('padel'), ('running'), ('cycling'),
  ('martial-arts'), ('hiking-outdoors'),
  ('cinema-film'), ('theater-performing-arts'), ('fun-activities'),
  ('fashion'), ('pets');

CREATE TEMPORARY TABLE _keep_vertical_slugs(slug TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _keep_vertical_slugs(slug) VALUES
  ('other'),
  ('food-drink'), ('sports-fitness'), ('entertainment'),
  ('fashion'), ('beauty-wellness'), ('lifestyle-hobbies'),
  ('travel-hospitality'), ('retail');

-- ---------------------------------------------------------------------------
-- 2. Ensure the "other" catch-all type exists (we reassign FK-protected rows
--    to it). Idempotent: if it's already there we skip. The seeder will fill
--    in `reward_multiplier_bps` and the vertical M2M links on the next run.
-- ---------------------------------------------------------------------------
INSERT INTO app.advertiser_types (name, slug, scope, sort_order, created_at, updated_at)
VALUES (
  'Other',
  'other',
  ARRAY['LOCAL']::"app"."AdvertiserScope"[],
  0,
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Reassign FK-protected rows pointing to removed types -> "other"
-- ---------------------------------------------------------------------------
WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.local_subaccounts
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.pending_local_subaccounts
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.non_local_subaccounts
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.pending_non_local_subaccounts
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.campaigns
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

WITH other_type AS (
  SELECT id FROM app.advertiser_types WHERE slug = 'other' LIMIT 1
),
removed_type_ids AS (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
)
UPDATE app.pending_campaigns
SET type_id = (SELECT id FROM other_type)
WHERE type_id IN (SELECT id FROM removed_type_ids);

-- ---------------------------------------------------------------------------
-- 4. Delete M2M join rows referencing soon-to-be-removed advertiser_types
-- ---------------------------------------------------------------------------
DELETE FROM app."_AdvertiserTypeToVertical"
WHERE "A" IN (
  SELECT id FROM app.advertiser_types
  WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs)
);

-- ---------------------------------------------------------------------------
-- 5. Delete orphan advertiser_types rows
-- ---------------------------------------------------------------------------
DELETE FROM app.advertiser_types
WHERE slug NOT IN (SELECT slug FROM _keep_type_slugs);

-- ---------------------------------------------------------------------------
-- 5.4. Ensure every kept interest slug exists in app.interests so the remap
--      in 5.5 can JOIN to them. The seed step (run after migrations) wires
--      _InterestToVertical M2M tagging; here we only need the interest rows.
--
--      Step 5.4a defends against the name-UNIQUE constraint that still
--      exists at this migration's runtime (the name column is dropped by a
--      later migration). If any removed-slug row happens to carry a name
--      that collides with one of the kept names, we rename it with a
--      "(legacy)" suffix so the INSERT below succeeds. Renamed rows still
--      carry their old slug and are deleted by step 6 + step 7 as part of
--      the normal orphan cleanup.
--
--      Step 5.4b is the upsert itself. ON CONFLICT (slug) DO NOTHING means
--      a kept slug that already exists in prod (e.g. gym-fitness) is left
--      untouched. Names match interestsCatalog.ts (English labels).
-- ---------------------------------------------------------------------------

-- 5.4a — defensive rename to dodge interests_name_key collisions.
UPDATE app.interests
SET name = name || ' (legacy)'
WHERE name IN (
  'Food & Dining', 'Cafe Culture', 'Bars & Nightlife', 'Beer & Wine',
  'Hair & Barbering', 'Beauty & Spa', 'Tattoo & Piercing',
  'Gym & Fitness', 'Yoga', 'Pilates', 'Climbing', 'Tennis', 'Padel',
  'Running', 'Cycling', 'Martial Arts', 'Hiking & Outdoors',
  'Cinema & Film', 'Theater & Performing Arts', 'Fun & Activities',
  'Fashion', 'Pets'
)
AND slug NOT IN (SELECT slug FROM _keep_interest_slugs);

-- 5.4b — upsert the 22 kept interest rows.
INSERT INTO app.interests (name, slug, sort_order, created_at, updated_at) VALUES
  ('Food & Dining',             'food-dining',             0, now(), now()),
  ('Cafe Culture',              'cafe-culture',            0, now(), now()),
  ('Bars & Nightlife',          'bars-nightlife',          0, now(), now()),
  ('Beer & Wine',               'beer-wine',               0, now(), now()),
  ('Hair & Barbering',          'hair-barbering',          0, now(), now()),
  ('Beauty & Spa',              'beauty-spa',              0, now(), now()),
  ('Tattoo & Piercing',         'tattoo-piercing',         0, now(), now()),
  ('Gym & Fitness',             'gym-fitness',             0, now(), now()),
  ('Yoga',                      'yoga',                    0, now(), now()),
  ('Pilates',                   'pilates',                 0, now(), now()),
  ('Climbing',                  'climbing',                0, now(), now()),
  ('Tennis',                    'tennis',                  0, now(), now()),
  ('Padel',                     'padel',                   0, now(), now()),
  ('Running',                   'running',                 0, now(), now()),
  ('Cycling',                   'cycling',                 0, now(), now()),
  ('Martial Arts',              'martial-arts',            0, now(), now()),
  ('Hiking & Outdoors',         'hiking-outdoors',         0, now(), now()),
  ('Cinema & Film',             'cinema-film',             0, now(), now()),
  ('Theater & Performing Arts', 'theater-performing-arts', 0, now(), now()),
  ('Fun & Activities',          'fun-activities',          0, now(), now()),
  ('Fashion',                   'fashion',                 0, now(), now()),
  ('Pets',                      'pets',                    0, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5.5. Remap customer + pending-customer interests from removed → kept slugs
--      BEFORE the deletions below, so the dominant signal is preserved
--      instead of silently dropped. Each mapping consolidates a removed
--      slug into the closest surviving slug. Topics with no close fit
--      (ai-productivity, anime-manga, books, cars-automotive, travel,
--      luxury-travel, etc.) are intentionally NOT in the remap table and
--      get dropped by step 6 below.
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE _interest_remap(from_slug TEXT PRIMARY KEY, to_slug TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO _interest_remap(from_slug, to_slug) VALUES
  -- Food
  ('restaurants',          'food-dining'),
  ('foodies',              'food-dining'),
  ('fine-dining',          'food-dining'),
  ('street-food',          'food-dining'),
  ('baking-pastry',        'food-dining'),
  ('vegan-plant-based',    'food-dining'),
  -- Cafe
  ('cafes-brunch',         'cafe-culture'),
  ('coffee-culture',       'cafe-culture'),
  -- Beauty / wellness
  ('beauty-makeup',        'beauty-spa'),
  ('skincare',             'beauty-spa'),
  ('fragrance',            'beauty-spa'),
  ('wellness-spa',         'beauty-spa'),
  ('hair-nails',           'beauty-spa'),
  ('health-wellness',      'beauty-spa'),
  -- Outdoors
  ('backpacking',          'hiking-outdoors'),
  ('outdoor-adventure',    'hiking-outdoors'),
  -- Entertainment
  ('movies-tv',            'cinema-film'),
  ('theater-arts',         'theater-performing-arts'),
  ('stand-up-comedy',      'theater-performing-arts'),
  ('concerts-festivals',   'fun-activities'),
  ('live-music',           'fun-activities'),
  ('theme-parks',          'fun-activities'),
  ('gaming',               'fun-activities'),
  -- Fashion
  ('shopping',             'fashion'),
  ('luxury-goods',         'fashion'),
  ('streetwear',           'fashion'),
  ('sneakers',             'fashion'),
  -- Sports — generic athletic bucket for team / individual sports without a
  -- dedicated kept slug. Racquet sports route to tennis; boxing to martial-arts.
  ('bodybuilding',         'gym-fitness'),
  ('american-football',    'gym-fitness'),
  ('soccer',               'gym-fitness'),
  ('basketball',           'gym-fitness'),
  ('baseball',             'gym-fitness'),
  ('volleyball',           'gym-fitness'),
  ('team-sports',          'gym-fitness'),
  ('swimming',             'gym-fitness'),
  ('golf',                 'gym-fitness'),
  ('boxing',               'martial-arts'),
  ('pickleball',           'tennis');

-- Promote Customer↔Interest links from removed interest IDs to their kept
-- targets. Composite PK (A,B) on _CustomerToInterest deduplicates anyone who
-- already had both the old and the new interest.
INSERT INTO app."_CustomerToInterest" ("A", "B")
SELECT ci."A", kept.id
FROM app."_CustomerToInterest" ci
JOIN app.interests i_from ON i_from.id = ci."B"
JOIN _interest_remap rm   ON rm.from_slug = i_from.slug
JOIN app.interests kept   ON kept.slug = rm.to_slug
ON CONFLICT DO NOTHING;

-- Same promotion for PendingCustomer↔Interest links.
INSERT INTO app."_InterestToPendingCustomer" ("A", "B")
SELECT kept.id, ipc."B"
FROM app."_InterestToPendingCustomer" ipc
JOIN app.interests i_from ON i_from.id = ipc."A"
JOIN _interest_remap rm   ON rm.from_slug = i_from.slug
JOIN app.interests kept   ON kept.slug = rm.to_slug
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Delete M2M join rows referencing soon-to-be-removed interests
-- ---------------------------------------------------------------------------
DELETE FROM app."_CustomerToInterest"
WHERE "B" IN (
  SELECT id FROM app.interests
  WHERE slug NOT IN (SELECT slug FROM _keep_interest_slugs)
);

DELETE FROM app."_InterestToPendingCustomer"
WHERE "A" IN (
  SELECT id FROM app.interests
  WHERE slug NOT IN (SELECT slug FROM _keep_interest_slugs)
);

DELETE FROM app."_InterestToVertical"
WHERE "A" IN (
  SELECT id FROM app.interests
  WHERE slug NOT IN (SELECT slug FROM _keep_interest_slugs)
);

-- ---------------------------------------------------------------------------
-- 7. Delete orphan interest rows
-- ---------------------------------------------------------------------------
DELETE FROM app.interests
WHERE slug NOT IN (SELECT slug FROM _keep_interest_slugs);

-- ---------------------------------------------------------------------------
-- 8. Delete M2M links pointing to soon-to-be-removed verticals.
-- This also strips dead tags off SURVIVING types/interests (e.g. zoo's
-- education tag, gym-fitness's health-medical tag).
-- ---------------------------------------------------------------------------
DELETE FROM app."_AdvertiserTypeToVertical"
WHERE "B" IN (
  SELECT id FROM app.verticals
  WHERE slug NOT IN (SELECT slug FROM _keep_vertical_slugs)
);

DELETE FROM app."_InterestToVertical"
WHERE "B" IN (
  SELECT id FROM app.verticals
  WHERE slug NOT IN (SELECT slug FROM _keep_vertical_slugs)
);

-- ---------------------------------------------------------------------------
-- 9. Delete orphan vertical rows
-- ---------------------------------------------------------------------------
DELETE FROM app.verticals
WHERE slug NOT IN (SELECT slug FROM _keep_vertical_slugs);

COMMIT;
