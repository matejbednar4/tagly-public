import { sql } from "kysely";
import { shareDeadSql } from "../../../utils/shares/shareAccess.js";
import prisma from "../../../prisma/prisma.js";
import { db } from "../../../db/kysely.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { unlockLockedBudgetForShare } from "../../../utils/money/ledger/events/sharePayment/unlockLockedBudgetForShare.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { sampleIds } from "../../helpers/sampleIds.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Reclaim advertiser budget stranded on dead shares. Finds shares that will never
 * pay (status UNPAYABLE, or admin-rejected via `approval_status` — rejection no
 * longer lives on `status`) that still have locked budget, and unlocks it. Safety
 * net for edge cases where the unlock on the happy path failed or was missed.
 */
export const recoverStuckAdvertiserBudget: MaintenanceTask = {
  name: "recover stuck advertiser budget",
  run: async ({ log }) => {
    const sharesWithStuckBudget = await db
      .selectFrom("app.shares as s")
      .innerJoin("app.transaction_ledger_events as e", "e.share_id", "s.id")
      .select([
        "s.id",
        "s.advertiser_id",
        sql<bigint>`SUM(e.delta_advertiser_locked_cents)`.as("locked_cents"),
      ])
      .where(shareDeadSql("s"))
      .where("s.advertiser_id", "is not", null)
      .groupBy(["s.id", "s.advertiser_id"])
      .having(sql`SUM(e.delta_advertiser_locked_cents)`, ">", 0n)
      .limit(T.fetchBatchSize)
      .execute();

    if (sharesWithStuckBudget.length === 0) return;

    const ids = sharesWithStuckBudget.map((s) => s.id);
    log.info(
      `(STUCK_BUDGET) found ${ids.length} shares with stuck budget (ids: ${sampleIds(ids)})`,
    );

    const t0 = Date.now();
    let unlocked = 0;

    for (const share of sharesWithStuckBudget) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          return unlockLockedBudgetForShare(tx, {
            advertiserId: share.advertiser_id!,
            shareId: share.id,
            meta: { reason: "maintenance-stuck-budget-recovery" },
          });
        });

        if (result.unlocked > 0n) {
          unlocked++;
          log.info(
            `(STUCK_BUDGET) unlocked ${result.unlocked} cents for share=${share.id}`,
          );
        }
      } catch (e) {
        reportWorkerError(e, {
          worker: "maintenance",
          phase: "task",
          task: "recoverStuckAdvertiserBudget",
          shareId: share.id,
        });
      }
    }

    log.info(
      `(STUCK_BUDGET) unlocked ${unlocked}/${ids.length} shares in ${Date.now() - t0}ms`,
    );
  },
};
