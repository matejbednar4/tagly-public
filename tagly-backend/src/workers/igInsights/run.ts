import prisma from "../../prisma/prisma.js";
import { insightsWorkerTunables as T } from "../../constants/workers/IG_INSIGHTS.js";
import { runJobQueue } from "../runtime/runJobQueue.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { markShareUnpayableAndUnlock } from "../../utils/shares/markShareUnpayableAndUnlock.js";
import { executeInsightsJob } from "./helpers/executeInsightsJob.js";
import { claimInsightsJobs } from "./helpers/claimInsightsJobs.js";

const WORKER = "igInsights";

/**
 * Instagram insights worker — fetches engagement metrics for posted shares.
 * Uses a two-phase claim (expiring stories first). On terminal failure the share
 * is voided (UNPAYABLE + budget unlocked). The audience snapshot is a separate
 * job, enqueued at share creation (not chained here).
 */
export function runInsightsWorker() {
  return runJobQueue({
    name: WORKER,
    tunables: T,
    table: prisma.instagramInsightsQueue,
    claim: claimInsightsJobs, // two-phase, expiring-stories-first
    execute: (job) => executeInsightsJob(job.share),
    jobLogContext: (job) => ({ shareId: job.share.id }),
    onTerminalFailure: async (job, { err, attempts, permanent }) => {
      const msg = (err as any)?.message ?? String(err);
      const detail = permanent
        ? `insights job failed permanently: ${msg}`
        : `insights job failed after ${attempts} attempts: ${msg}`;
      // Flip → UNPAYABLE + release the locked budget, atomically. User-facing
      // classification is INSIGHTS_UNAVAILABLE (stats couldn't be collected —
      // usually the story was deleted early or the IG link broke); the raw
      // error stays admin-side in `detail`.
      await prisma.$transaction((tx) =>
        markShareUnpayableAndUnlock(tx, {
          shareId: job.share.id,
          reason: "INSIGHTS_UNAVAILABLE",
          detail,
        }),
      );
    },
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runInsightsWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
