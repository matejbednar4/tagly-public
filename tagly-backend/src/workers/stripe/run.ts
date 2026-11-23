import { runWorkerLoop } from "../runtime/runWorkerLoop.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { LOCK_KEYS } from "../../constants/platform/POSTGRES_LOCKS.js";
import { stripeWorkerTunables as T } from "../../constants/workers/STRIPE.js";
import { findStripeJobs } from "./helpers/findStripeJobs.js";
import { processCreditPurchaseJob } from "./helpers/processCreditPurchaseJob.js";
import { reconcileWithdrawalPayouts } from "./helpers/reconcileWithdrawalPayouts.js";
import { reconcileMonthlyBudgets } from "./helpers/reconcileMonthlyBudgets.js";

const WORKER = "stripe";

/**
 * Stripe reconciliation worker — the fallback when Stripe webhooks fail to
 * deliver, plus the platform's one scheduled card charge. Three phases per
 * cycle:
 *   1. Credit-purchase reconciliation (queue-like `stripeCreditPurchase` table).
 *   2. Withdrawal payout reconciliation (query the `stripeWithdrawal` domain
 *      table) — runs every cycle, not gated on phase 1.
 *   3. Monthly-budget top-ups (query the `monthlyBudgetPeriod` domain table):
 *      charge every open period whose `nextRunAt` has passed, and email the
 *      upcoming-charge notices. Lives here rather than in its own service
 *      because it is the same singleton money/Stripe fleet member and needs
 *      the same lock — an off-session charge must never run in two task
 *      generations at once.
 *
 * Idempotency is via Stripe idempotency keys + idempotent ledger wrappers, and
 * a singleton advisory lock keeps the reconcile sweeps single-flight across the
 * ECS deploy overlap (two task generations run concurrently on every deploy —
 * without the lock, both would retrieve and re-book the same PENDING batch).
 * Paces at `loopIdleMs` every cycle.
 */
export function runStripeWorker() {
  return runWorkerLoop({
    name: WORKER,
    tunables: T,
    singleton: LOCK_KEYS.STRIPE_RECONCILE,
    tick: async ({ log, signal }) => {
      // 1) Credit purchase reconciliation (fallback for missed webhooks).
      const jobs = await findStripeJobs();
      if (jobs.length > 0) {
        log.info("reconciling credit-purchase jobs", { count: jobs.length });
        for (const job of jobs) {
          if (signal.shuttingDown) break;
          try {
            await processCreditPurchaseJob(job, log);
          } catch (err) {
            // Row stays PENDING and is retried next pass; report + continue.
            reportWorkerError(err, {
              worker: WORKER,
              phase: "job",
              jobId: job.id,
              creditPurchaseUid: job.uid,
            });
          }
        }
      }

      // 2) Withdrawal payout reconciliation (missed-webhook backstop).
      if (!signal.shuttingDown) await reconcileWithdrawalPayouts(log);

      // 3) Monthly-budget top-ups + upcoming-charge notices.
      if (!signal.shuttingDown) await reconcileMonthlyBudgets(log, signal);
    },
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runStripeWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
