import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import {
  findWithdrawalsMissingTransfer,
  findWithdrawalsNeedingSettle,
  findWithdrawalsNeedingPayout,
  findWithdrawalsToRetryPayout,
  findWithdrawalsToPoll,
  type StuckWithdrawal,
} from "./findStuckWithdrawals.js";
import { resolveMissingTransfer } from "../passes/resolveMissingTransfer.js";
import { settleWithdrawal } from "../passes/settleWithdrawal.js";
import { createMissingWithdrawalPayout } from "../passes/createMissingWithdrawalPayout.js";
import { retryWithdrawalPayout } from "../passes/retryWithdrawalPayout.js";
import { pollWithdrawalPayout } from "../passes/pollWithdrawalPayout.js";

/**
 * Run one reconciliation pass: per-item errors are reported (routed through the
 * single observability chokepoint) and never abort the batch. Each pass fn gets a
 * `pass`-scoped child logger so its own lines carry the label automatically.
 */
async function runPass(
  log: WorkerLogger,
  label: string,
  rows: StuckWithdrawal[],
  fn: (w: StuckWithdrawal, log: WorkerLogger) => Promise<void>,
) {
  if (rows.length === 0) return;
  log.info(label, { count: rows.length });
  const passLog = log.child({ pass: label });
  for (const w of rows) {
    try {
      await fn(w, passLog);
    } catch (err) {
      reportWorkerError(err, {
        worker: "stripe",
        phase: "job",
        pass: label,
        withdrawalUid: w.uid,
      });
    }
  }
}

/**
 * Withdrawal payout reconciliation, run once per stripe-worker loop. Five passes,
 * ordered so a row freshly advanced by an earlier pass is picked up by the next in
 * the same loop (missing-transfer → settle → create payout):
 *  1. resolve missing transfers (W-3a / W-16 crash + ambiguous-error recovery;
 *     a definitive Stripe rejection terminally fails the row + unlocks — W-17),
 *  2. settle transfers whose ledger event was lost (W-3b),
 *  3. create the payout for settled rows whose inline create didn't land
 *     (due-gated; create failures back off / park via W-19),
 *  4. retry FAILED/CANCELED payouts that are due (W-1), syncing any deferred
 *     transfer reversal first (W-18),
 *  5. poll IN_FLIGHT payouts that should have resolved (missed-webhook backstop).
 *
 * Invariant (the "never infinitely re-query" guarantee): every branch of every
 * pass either advances row state (transfer id, settle, payout, schedule) or
 * terminally removes the row from its query (FAILED/REVERSED/parked, or an
 * impossible-state filter) — the only unbounded re-entries left are genuine
 * progress checks (polling an in-flight payout; retrying a transient Stripe /
 * ledger outage, which is a fresh real attempt each tick, not a state loop).
 * All account lookups use `row.stripeAccountId` and all idempotency keys rebuild
 * from `row.purpose`, so reconciliation never depends on the customer row (W-2).
 */
export async function reconcileWithdrawalPayouts(log: WorkerLogger) {
  await runPass(
    log,
    "resolving missing transfers",
    await findWithdrawalsMissingTransfer(),
    resolveMissingTransfer,
  );
  await runPass(
    log,
    "settling withdrawals",
    await findWithdrawalsNeedingSettle(),
    settleWithdrawal,
  );
  await runPass(
    log,
    "creating missing payouts",
    await findWithdrawalsNeedingPayout(),
    createMissingWithdrawalPayout,
  );
  await runPass(
    log,
    "retrying failed payouts",
    await findWithdrawalsToRetryPayout(),
    retryWithdrawalPayout,
  );
  await runPass(
    log,
    "polling stale payouts",
    await findWithdrawalsToPoll(),
    pollWithdrawalPayout,
  );
}
