import prisma from "../../../prisma/prisma.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { ShutdownSignal } from "../../runtime/runWorkerLoop.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { runMonthlyBudgetTopUp } from "../../../utils/money/monthlyBudget/runMonthlyBudgetTopUp.js";

/**
 * The monthly-budget phase of the stripe worker: run every OPEN
 * `MonthlyBudgetPeriod` whose `nextRunAt` has passed (the 1st at
 * `CHARGE_HOUR_UTC`, a backed-off retry after a decline, or an
 * ambiguous-outcome recheck). Each goes through `runMonthlyBudgetTopUp`, which
 * always moves `nextRunAt` forward on every outcome, so a period is never
 * re-picked in a hot loop. Per-period errors are reported and never abort the
 * batch. The worker's singleton advisory lock sits on top of the run util's
 * `externalRef` + Stripe idempotency guard.
 *
 * The 3-day "upcoming charge" email is NOT here — it moves no money, so it is
 * a maintenance task (`scheduleMonthlyBudgetNotices`). Nothing couples the
 * two: a period is either due (`nextRunAt <= now`, this pass) or announced
 * there (`nextRunAt > now + MIN_LEAD`), never both.
 */
export async function reconcileMonthlyBudgets(
  log: WorkerLogger,
  signal: ShutdownSignal,
): Promise<void> {
  const now = new Date();

  const due = await prisma.monthlyBudgetPeriod.findMany({
    where: { endedAt: null, nextRunAt: { lte: now } },
    select: { id: true, advertiserId: true },
    orderBy: { nextRunAt: "asc" },
    take: T.monthlyBudgetBatchSize,
  });
  if (due.length > 0) {
    log.info("monthly budget: running due top-ups", { count: due.length });
    const passLog = log.child({ pass: "monthly-budget-topup" });
    for (const period of due) {
      if (signal.shuttingDown) return;
      try {
        // By period id (never "the advertiser's open period"): the run must
        // charge the row this poll selected, not whatever is open by the time
        // it runs. The advertiser id rides along as an ownership assertion.
        const outcome = await runMonthlyBudgetTopUp(
          period.id,
          period.advertiserId,
          now,
        );
        passLog.info("monthly budget run", {
          periodId: period.id,
          advertiserId: period.advertiserId,
          ...outcome,
        });
      } catch (err) {
        reportWorkerError(err, {
          worker: "stripe",
          phase: "job",
          pass: "monthly-budget-topup",
          periodId: period.id,
          advertiserId: period.advertiserId,
        });
      }
    }
  }
}
