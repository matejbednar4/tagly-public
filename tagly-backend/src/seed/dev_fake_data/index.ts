/**
 * Account Seeds Entry Point
 *
 * Runs all account-related seeds in the correct order:
 * 0. Cleanup - Deletes existing seed data (allows re-running)
 * 1. Advertisers - Creates advertiser accounts with budgets
 * 2. Business Pages - Creates local subaccounts (business pages)
 * 3. Admin - Creates admin accounts (before shares/links so they can stamp it)
 * 4. Links - Business web links in every review state (pending-links queue)
 * 5. Customers - Creates customer accounts with Instagram links
 * 6. Shares - Creates shares with insights, pricing, ledger events, and the
 *    Review-tab queue material (#11-#17)
 *
 * Prerequisites:
 * - yarn seed:dev (runs notifications and verticals first)
 *
 * Usage:
 * - yarn seed:dev:accounts
 */

import { envVariables } from "../../environment/envVariables.js";
import { sql } from "kysely";
import { db, shutdownDb } from "../../db/kysely.js";
import prisma from "../../prisma/prisma.js";
import { redis, shutdownRedis } from "../../utils/clients/redis.js";
import { seedAdvertisers } from "./advertisers.js";
import { seedBusinessPages } from "./businessPages.js";
import { seedCustomers } from "./customers.js";
import { seedShares } from "./shares.js";
import { seedAdmin } from "./admin.js";
import { seedLinks } from "./links.js";
import { clearSeedS3Folder } from "./clearSeedS3Folder.js";

/**
 * Cleanup all account data to allow re-running the seed
 * Deletes everything except verticals/notifications (seeded by yarn seed)
 */
/**
 * Tables cleanup must NEVER touch — everything else in `app`/`jobs` is wiped.
 *
 * This is deliberately a KEEP-list, not a delete-list. A delete-list drifts
 * silently: add a table, forget to list it, and its rows survive every reset as
 * orphans pointing at deleted owners. That is exactly what happened with
 * `stripe_withdrawals` / `stripe_credit_purchases` (their customer/advertiser FKs
 * are SetNull, not Cascade, so they outlived the wipe while their ledger events
 * were deleted — the DB then claimed money had moved with no ledger record and
 * no owner; see FINDINGS A-NEW13). With a keep-list a new table is wiped by
 * default, and the only failure mode is loud and recoverable (a catalog you
 * forgot to keep gets re-seeded on the next boot).
 */
const KEEP_TABLES = new Set([
  // Migration history — never touch.
  "_prisma_migrations",
  // Reference catalogs (seeded by `yarn seed` + re-seeded at app boot).
  "verticals",
  "advertiser_types",
  "interests",
  "notification_categories",
  "notification_events",
  "_AdvertiserTypeToVertical",
  "_InterestToVertical",
  // Singleton row at id=1. `applyBalancesFromEvent` updates it with `update`
  // (not `updateMany`) precisely so a missing row hard-fails P2025 — truncating
  // it would break every subsidized settle. Zeroed below instead.
  "platform_balance",
]);

/**
 * Wipes all account data by truncating every table in `app`/`jobs` except
 * KEEP_TABLES.
 *
 * `TRUNCATE ... CASCADE` resolves FK order itself, so there is no hand-ordered
 * delete sequence to keep in sync with the schema.
 *
 * ⚠️ Deliberately WITHOUT `RESTART IDENTITY`: sequences keep advancing, so rows
 * created after a reset can never reuse an id that a stale Redis reward-estimate
 * key is still pointing at (the cache flush below is best-effort and cannot run
 * when Redis is unreachable, e.g. seeding staging from a laptop — staging Redis
 * is VPC-only).
 *
 * ⚠️ This DOES truncate `monetized_instagram_posts`, the once-only story
 * registry that E074 says is append-only. That rule protects real accounts; a
 * dev/staging reset that left every previously-used story permanently burned
 * would not be a reset. Guarded to development/staging by `runAccountSeed`.
 */
async function cleanupSeedData(): Promise<void> {
  console.log("Cleaning up all account data...\n");

  const rows = await sql<{ schemaname: string; tablename: string }>`
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('app', 'jobs')
  `.execute(db);

  const targets = rows.rows
    .filter((r) => !KEEP_TABLES.has(r.tablename))
    .map((r) => `"${r.schemaname}"."${r.tablename}"`);

  if (targets.length > 0) {
    await sql.raw(`TRUNCATE TABLE ${targets.join(", ")} CASCADE`).execute(db);
    console.log(`  → Truncated ${targets.length} tables`);
  }

  // Zero the platform singleton rather than deleting it (see KEEP_TABLES).
  await prisma.platformBalance.update({
    where: { id: 1 },
    data: { lockedUsdCents: 0n },
  });
  console.log("  → Reset platform balance to 0");

  // 19. S3 — wipe the stage folder so uploaded seed media doesn't stack up
  // across runs (mirrors the DB wipe above).
  await clearSeedS3Folder();

  // 20. Redis — drop every cached reward estimate. Re-seeding reuses the same
  // autoincrement ids (customer 1, businesses 1..N) and never bumps the
  // generation counters, so entries priced against the PRE-seed data keep
  // matching the new rows' cache keys for up to 24h (the entry TTL) and serve
  // stale prices — e.g. frequency-dampened near-zero rewards computed while the
  // old shares were hours fresh. Best-effort: Redis being down only costs the
  // cleanup (estimates then just recompute on the TTL), never the seed.
  try {
    let cleared = 0;
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        "reward:est:*",
        "COUNT",
        200,
      );
      cursor = next;
      if (keys.length > 0) cleared += await redis.del(...keys);
    } while (cursor !== "0");
    console.log(`  → Cleared ${cleared} cached reward estimates from Redis`);
  } catch {
    console.warn(
      "  → Could not clear the Redis reward-estimate cache (is Redis up?) — stale estimates may persist up to 24h",
    );
  }

  console.log("  → Cleanup complete\n");
}

export async function runAccountSeed(): Promise<void> {
  // Check environment
  if (
    envVariables.APP_STAGE !== "development" &&
    envVariables.APP_STAGE !== "staging"
  ) {
    console.error(
      `Account seed only runs in development or staging. Current: ${envVariables.APP_STAGE}`
    );
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    ACCOUNT SEED (plan.md)                      ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Step 0: Cleanup existing seed data
  console.log("Step 0/6: Cleaning up existing data...\n");
  await cleanupSeedData();

  // Step 1: Seed advertisers
  console.log("Step 1/6: Seeding advertisers...\n");
  await seedAdvertisers();

  // Step 2: Seed business pages
  console.log("\nStep 2/6: Seeding business pages...\n");
  await seedBusinessPages();

  // Step 3: Seed admin (BEFORE shares + links, so seeded rows can stamp the
  // reviewing admin via reviewedByAdminId).
  console.log("\nStep 3/6: Seeding admin...\n");
  await seedAdmin();

  // Step 4: Seed business links (needs locals + admin — the Review tab's
  // "Review links" queue material).
  console.log("\nStep 4/6: Seeding links...\n");
  await seedLinks();

  // Step 5-6: Seed customers and shares in a transaction
  console.log("\nStep 5-6/6: Seeding customers and shares...\n");
  await prisma.$transaction(
    async (tx) => {
      const customerMap = await seedCustomers(tx);
      await seedShares(tx, customerMap);
    },
    { timeout: 1200_000 }
  );

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                   ACCOUNT SEED COMPLETED!                      ");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

// Only run if executed directly
const isDirectExecution = process.argv[1]?.includes("dev_fake_data/index.ts") ||
                          process.argv[1]?.includes("dev_fake_data/index.js");
if (isDirectExecution) {
  runAccountSeed()
    .catch((e) => {
      console.error("Account seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      // The cleanup truncate runs through Kysely, so its pg pool must be closed
      // too or the process hangs on an open connection after the seed finishes.
      await shutdownDb();
      await shutdownRedis();
    });
}
