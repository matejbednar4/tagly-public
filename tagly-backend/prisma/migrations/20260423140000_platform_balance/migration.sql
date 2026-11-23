-- CreateTable
CREATE TABLE "app"."platform_balance" (
    "id" SERIAL NOT NULL,
    "locked_cents" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "platform_balance_pkey" PRIMARY KEY ("id")
);

-- Seed: insert the singleton row so application code can always do
-- UPDATE platform_balance SET ... WHERE id = 1 without checking existence.
INSERT INTO "app"."platform_balance" ("id", "locked_cents") VALUES (1, 0);
