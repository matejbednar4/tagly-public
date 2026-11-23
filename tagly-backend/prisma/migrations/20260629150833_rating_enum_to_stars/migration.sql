/*
  Convert `Share.rating` from the `Rating` enum (EXCEPTIONAL/GOOD/BAD/UNRATED/
  REPORTED) to an int of half-stars: 1–10 = ½★–5★ (displayed star value is n/2),
  NULL = unrated.

  Mapping (hand-added backfill, runs before the enum type is dropped):
    EXCEPTIONAL → 10 (5★)   GOOD → 7 (3½★)   BAD → 2 (1★)
    UNRATED / REPORTED → NULL  (neither is a quality score; "reported" lives on the
                                ShareReport row + the derived customer status)

  The legacy `Rating` enum survives only on the v1 wire from here on — the backend
  maps enum↔stars at the v1 boundary (@tagly/models ratingEnum↔Stars). The DB enum
  type is dropped below.
*/

-- Add the new int column, backfill from the enum, then swap it into place.
ALTER TABLE "app"."shares" ADD COLUMN "rating_new" INTEGER;

UPDATE "app"."shares" SET "rating_new" = CASE "rating"
  WHEN 'EXCEPTIONAL' THEN 10
  WHEN 'GOOD' THEN 7
  WHEN 'BAD' THEN 2
  ELSE NULL
END;

ALTER TABLE "app"."shares" DROP COLUMN "rating";
ALTER TABLE "app"."shares" RENAME COLUMN "rating_new" TO "rating";

-- No column references the enum type any more.
DROP TYPE "app"."Rating";
