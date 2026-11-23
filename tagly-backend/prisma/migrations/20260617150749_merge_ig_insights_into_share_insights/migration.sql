-- Merge ig_story_insights / ig_post_insights / ig_reel_insights into a single
-- share_insights table (1:1 with shares; media type read from shares.ig_post_type).
-- Order matters: create the new table, backfill from the three legacy tables,
-- THEN drop them — so no insight rows are lost.

-- CreateTable
CREATE TABLE "app"."share_insights" (
    "share_id" INTEGER NOT NULL,
    "reach" INTEGER,
    "views" INTEGER,
    "shares" INTEGER,
    "total_interactions" INTEGER,
    "follows" INTEGER,
    "profile_visits" INTEGER,
    "comments" INTEGER,
    "likes" INTEGER,
    "saved" INTEGER,
    "replies" INTEGER,
    "taps_forward" INTEGER,
    "taps_back" INTEGER,
    "exits" INTEGER,
    "ig_reels_avg_watch_time" INTEGER,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "share_insights_pkey" PRIMARY KEY ("share_id")
);

-- AddForeignKey
ALTER TABLE "app"."share_insights" ADD CONSTRAINT "share_insights_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "app"."shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: each share is in exactly one legacy table (gated by ig_post_type),
-- so these three inserts never collide on the share_id PK. Columns not present
-- in a given source table are written as NULL.
INSERT INTO "app"."share_insights" (
    "share_id", "reach", "views", "shares", "total_interactions", "follows", "profile_visits",
    "comments", "likes", "saved", "replies", "taps_forward", "taps_back", "exits",
    "ig_reels_avg_watch_time", "fetched_at", "created_at", "updated_at"
)
SELECT
    "share_id", "reach", "views", "shares", "total_interactions", "follows", "profile_visits",
    NULL, NULL, NULL, "replies", "taps_forward", "taps_back", "exits",
    NULL, "fetched_at", "created_at", "updated_at"
FROM "app"."ig_story_insights";

INSERT INTO "app"."share_insights" (
    "share_id", "reach", "views", "shares", "total_interactions", "follows", "profile_visits",
    "comments", "likes", "saved", "replies", "taps_forward", "taps_back", "exits",
    "ig_reels_avg_watch_time", "fetched_at", "created_at", "updated_at"
)
SELECT
    "share_id", "reach", "views", "shares", "total_interactions", "follows", "profile_visits",
    "comments", "likes", "saved", NULL, NULL, NULL, NULL,
    NULL, "fetched_at", "created_at", "updated_at"
FROM "app"."ig_post_insights";

INSERT INTO "app"."share_insights" (
    "share_id", "reach", "views", "shares", "total_interactions", "follows", "profile_visits",
    "comments", "likes", "saved", "replies", "taps_forward", "taps_back", "exits",
    "ig_reels_avg_watch_time", "fetched_at", "created_at", "updated_at"
)
SELECT
    "share_id", "reach", "views", "shares", "total_interactions", NULL, NULL,
    "comments", "likes", "saved", NULL, NULL, NULL, NULL,
    "ig_reels_avg_watch_time", "fetched_at", "created_at", "updated_at"
FROM "app"."ig_reel_insights";

-- DropForeignKey
ALTER TABLE "app"."ig_post_insights" DROP CONSTRAINT "ig_post_insights_share_id_fkey";
-- DropForeignKey
ALTER TABLE "app"."ig_reel_insights" DROP CONSTRAINT "ig_reel_insights_share_id_fkey";
-- DropForeignKey
ALTER TABLE "app"."ig_story_insights" DROP CONSTRAINT "ig_story_insights_share_id_fkey";

-- DropTable
DROP TABLE "app"."ig_post_insights";
-- DropTable
DROP TABLE "app"."ig_reel_insights";
-- DropTable
DROP TABLE "app"."ig_story_insights";
