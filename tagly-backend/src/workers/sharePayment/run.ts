import { runWorkerLoop } from "../runtime/runWorkerLoop.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import type { WorkerLogger } from "../runtime/workerLogger.js";
import { LOCK_KEYS } from "../../constants/platform/POSTGRES_LOCKS.js";
import { sharePaymentWorkerTunables as T } from "../../constants/workers/SHARE_PAYMENT.js";
import { findSharesReadyForPayment } from "./helpers/findSharesReadyForPayment.js";
import {
  executeSharePayment,
  type SharePaymentOutcome,
} from "./helpers/executeSharePayment.js";

const WORKER = "sharePayment";

type ShareForPayment = Awaited<
  ReturnType<typeof findSharesReadyForPayment>
>[number];

/**
 * Share payment worker — polls the `share` domain table for shares ready to pay
 * (PROCESSING + APPROVED + data captured + aged), settles each per its funding
 * mode. Idempotent via ledger external refs; every settle tx opens with the
 * atomic PROCESSING → PAID claim (markSharePaidOrThrow), which serializes
 * settles against concurrent voids (IG disconnect, account deletion). Spins
 * while there's a backlog; idles (jittered) when empty.
 */
export function runSharePaymentWorker() {
  return runWorkerLoop({
    name: WORKER,
    tunables: T,
    // Singleton: `findSharesReadyForPayment` is a plain scan with no claim
    // column, so two instances (ECS deploy overlap) would settle the same FIFO
    // batch — the PAYG card charge happens BEFORE the markSharePaidOrThrow CAS,
    // so the loser has already talked to Stripe by the time it loses.
    singleton: LOCK_KEYS.SHARE_PAYMENT,
    tick: async ({ log }) => {
      const shares = await findSharesReadyForPayment();
      if (shares.length === 0) return false;

      const slice = shares.slice(0, T.concurrency);
      const results = await Promise.all(
        slice.map((s) => processOneShare(s, log)),
      );

      log.info("processed shares", {
        count: slice.length,
        paid: results.filter((r) => r === "paid").length,
        deferred: results.filter((r) => r === "deferred").length,
        unpayable: results.filter((r) => r === "unpayable").length,
        skipped: results.filter((r) => r === "skipped").length,
      });
      return true; // keep draining while there's work
    },
  });
}

async function processOneShare(
  share: ShareForPayment,
  log: WorkerLogger,
): Promise<SharePaymentOutcome> {
  const t0 = Date.now();
  try {
    const outcome = await executeSharePayment(share);
    log.info("share processed", {
      shareUid: share.uid,
      outcome,
      durationMs: Date.now() - t0,
    });
    return outcome;
  } catch (err) {
    // executeSharePayment handles its own errors; this is the belt-and-suspenders
    // path for an unexpected throw.
    reportWorkerError(err, {
      worker: WORKER,
      phase: "job",
      shareUid: share.uid,
    });
    return "unpayable";
  }
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runSharePaymentWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
