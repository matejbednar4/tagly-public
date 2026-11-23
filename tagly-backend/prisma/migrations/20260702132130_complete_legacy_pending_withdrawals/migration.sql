-- Data backfill (no schema change): mark all legacy PENDING withdrawals COMPLETED.
--
-- Before the platform-managed payout flow, withdrawals were delivered by Stripe's
-- *automatic* payout schedule (standard withdrawals never got a manual payout;
-- instant ones that failed fell back to the same automatic sweep). Either way the
-- automatic payout carried no metadata, so `payout.paid` never matched our rows and
-- they stayed PENDING — including the ones that recorded an instant `failure_code`,
-- which were still paid out by the next automatic sweep. So every legacy PENDING row
-- is really settled: flip them COMPLETED and clear the stale failure annotation.
--
-- Runs via `migrate deploy` BEFORE the new backend serves traffic, so at execution
-- time every PENDING row is legacy — no new-flow (v1 or v2) withdrawal exists yet.
UPDATE "app"."stripe_withdrawals"
SET "status"          = 'COMPLETED',
    "failure_code"    = NULL,
    "failure_message" = NULL
WHERE "status" = 'PENDING';
