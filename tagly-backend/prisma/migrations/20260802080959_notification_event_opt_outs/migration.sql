-- CreateTable
CREATE TABLE "app"."notification_event_opt_outs" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER,
    "advertiser_id" INTEGER,
    "event_id" INTEGER NOT NULL,
    "disabled_channels" "app"."NotificationChannel"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_event_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_event_opt_outs_event_id_idx" ON "app"."notification_event_opt_outs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_event_opt_outs_customer_id_event_id_key" ON "app"."notification_event_opt_outs"("customer_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_event_opt_outs_advertiser_id_event_id_key" ON "app"."notification_event_opt_outs"("advertiser_id", "event_id");

-- AddForeignKey
ALTER TABLE "app"."notification_event_opt_outs" ADD CONSTRAINT "notification_event_opt_outs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notification_event_opt_outs" ADD CONSTRAINT "notification_event_opt_outs_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notification_event_opt_outs" ADD CONSTRAINT "notification_event_opt_outs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app"."notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one owner per row (customer XOR advertiser). Prisma cannot express a
-- CHECK constraint, so it exists only here.
ALTER TABLE "app"."notification_event_opt_outs"
    ADD CONSTRAINT "notification_event_opt_outs_owner_xor_check"
    CHECK (("customer_id" IS NULL) <> ("advertiser_id" IS NULL));

-- Data migration: convert the legacy opt-IN preference rows to opt-OUT rows.
-- disabled = the event's available channels the account did NOT have enabled,
-- MINUS the event's mandatory channels: a mandatory channel can never be opted
-- out (the resolution rule always sends it and the API rejects disabling it),
-- so it must never be stored in a disabled set either — legacy rows may lack a
-- mandatory channel in enabled_channels precisely because the old code sent
-- mandatory regardless of preferences.
-- An empty complement (everything deliverable was enabled) is the new default
-- state and is represented by NO row, so those rows are skipped. The legacy
-- tables are kept (the pre-v2 backend still writes them during the Phase 2
-- rolling overlap) and are dropped at Phase 3 together with v1.
INSERT INTO "app"."notification_event_opt_outs" ("customer_id", "event_id", "disabled_channels", "updated_at")
SELECT p."customerId", p."eventId", d."disabled", CURRENT_TIMESTAMP
FROM "app"."customer_notification_event_preferences" p
JOIN "app"."notification_events" e ON e."id" = p."eventId"
CROSS JOIN LATERAL (
    SELECT COALESCE(array_agg(c), ARRAY[]::"app"."NotificationChannel"[]) AS "disabled"
    FROM unnest(e."available_channels") AS c
    WHERE NOT (c = ANY(p."enabled_channels"))
      AND NOT (c = ANY(COALESCE(e."mandatory_channels", ARRAY[]::"app"."NotificationChannel"[])))
) d
WHERE cardinality(d."disabled") > 0;

INSERT INTO "app"."notification_event_opt_outs" ("advertiser_id", "event_id", "disabled_channels", "updated_at")
SELECT p."advertiserId", p."eventId", d."disabled", CURRENT_TIMESTAMP
FROM "app"."advertiser_notification_event_preferences" p
JOIN "app"."notification_events" e ON e."id" = p."eventId"
CROSS JOIN LATERAL (
    SELECT COALESCE(array_agg(c), ARRAY[]::"app"."NotificationChannel"[]) AS "disabled"
    FROM unnest(e."available_channels") AS c
    WHERE NOT (c = ANY(p."enabled_channels"))
      AND NOT (c = ANY(COALESCE(e."mandatory_channels", ARRAY[]::"app"."NotificationChannel"[])))
) d
WHERE cardinality(d."disabled") > 0;
