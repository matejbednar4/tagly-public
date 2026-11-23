import { sql } from "kysely";
import { shareDeadSql } from "../../../utils/shares/shareAccess.js";
import prisma from "../../../prisma/prisma.js";
import { db } from "../../../db/kysely.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { unlockPlatformBudgetForShare } from "../../../utils/money/ledger/events/sharePayment/unlockPlatformBudgetForShare.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { sampleIds } from "../../helpers/sampleIds.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Reclaim platform budget stranded on terminal subsidized shares. Handles the
 * edge case where `executeSharePayment` fails before `wasSubsidizedAtCreation` is
 * set, leaving `deltaPlatformLockedCents` positive with no unlock event.
 *
 * NOTE: filter by SUM(delta_platform_locked_cents) > 0, NOT by advertiserId IS
 * NULL. advertiserId is not a reliable subsidization signal — it can be null for
 * shares of deleted advertisers, or non-null for subsidized shares transferred to
 * an advertiser via adminSetLocalAdvertiser. The ledger column is the correct
 * signal because only subsidized share locks ever write delta_platform_locked_cents.
 */
export const recoverStuckPlatformBudget: MaintenanceTask = {
  name: "recover stuck platform budget",
  run: async ({ log }) => {
    const sharesWithStuckPlatformBudget = await db
      .selectFrom("app.shares as s")
      .innerJoin("app.transaction_ledger_events as e", "e.share_id", "s.id")
      .select([
        "s.id",
        sql<bigint>`SUM(e.delta_platform_locked_cents)`.as("locked_cents"),
      ])
      .where(shareDeadSql("s"))
      .groupBy(["s.id"])
      .having(sql`SUM(e.delta_platform_locked_cents)`, ">", 0n)
      .limit(T.fetchBatchSize)
      .execute();

    if (sharesWithStuckPlatformBudget.length === 0) return;

    const ids = sharesWithStuckPlatformBudget.map((s) => s.id);
    log.info(
      `(STUCK_PLATFORM_BUDGET) found ${ids.length} shares with stuck platform budget (ids: ${sampleIds(ids)})`,
    );

    const t0 = Date.now();
    let unlocked = 0;

    for (const share of sharesWithStuckPlatformBudget) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          return unlockPlatformBudgetForShare(tx, {
            shareId: share.id,
            meta: { reason: "maintenance-stuck-platform-budget-recovery" },
          });
        });

        if (result.unlocked > 0n) {
          unlocked++;
          log.info(
            `(STUCK_PLATFORM_BUDGET) unlocked ${result.unlocked} cents for share=${share.id}`,
          );
        }
      } catch (e) {
        reportWorkerError(e, {
          worker: "maintenance",
          phase: "task",
          task: "recoverStuckPlatformBudget",
          shareId: share.id,
        });
      }
    }

    log.info(
      `(STUCK_PLATFORM_BUDGET) unlocked ${unlocked}/${ids.length} shares in ${Date.now() - t0}ms`,
    );
  },
};
