-- CreateTable
CREATE TABLE "app"."monetized_instagram_posts" (
    "ig_post_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monetized_instagram_posts_pkey" PRIMARY KEY ("ig_post_id")
);

-- Backfill: every Instagram post id ever attached to a share is monetized-once
-- (E074). Share.ig_post_id is unique, so no conflicts are possible today; the
-- ON CONFLICT guard only makes a re-run of this statement idempotent.
INSERT INTO "app"."monetized_instagram_posts" ("ig_post_id")
SELECT "ig_post_id" FROM "app"."shares" WHERE "ig_post_id" IS NOT NULL
ON CONFLICT ("ig_post_id") DO NOTHING;
