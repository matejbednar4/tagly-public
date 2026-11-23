import prisma from "../../prisma/prisma.js";
import { snapshotWorkerTunables as T } from "../../constants/workers/IG_SNAPSHOT.js";
import { runJobQueue } from "../runtime/runJobQueue.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { markShareUnpayableAndUnlock } from "../../utils/shares/markShareUnpayableAndUnlock.js";
import { executeSnapshotJob } from "./helpers/executeSnapshotJob.js";
import {
  claimSnapshotJobs,
  type SnapshotJob,
} from "./helpers/claimSnapshotJobs.js";

const WORKER = "igSnapshot";

/**
 * Instagram snapshot worker — captures audience data (followers, location,
 * demographics). Share-level and account-level jobs both flow through here via
 * the oldest-due-first `claimSnapshotJobs` claim. On terminal failure of a
 * share-level job the share is voided (UNPAYABLE + budget unlocked); account-
 * level jobs have no share side effect.
 */
export function runSnapshotWorker() {
  return runJobQueue<SnapshotJob>({
    name: WORKER,
    tunables: T,
    table: prisma.instagramSnapshotQueue,
    claim: claimSnapshotJobs,
    execute: executeSnapshotJob,
    jobLogContext: (job) => (job.share ? { shareId: job.share.id } : {}),
    onTerminalFailure: async (job, { err, attempts, permanent }) => {
      if (!job.share) return;
      const shareId = job.share.id; // capture before the tx closure (narrows null)
      const msg = (err as any)?.message ?? String(err);
      const detail = permanent
        ? `snapshot job failed permanently: ${msg}`
        : `snapshot job failed after ${attempts} attempts: ${msg}`;
      // Flip → UNPAYABLE + release the locked budget, atomically. User-facing
      // classification is INSIGHTS_UNAVAILABLE; the raw error stays admin-side.
      await prisma.$transaction((tx) =>
        markShareUnpayableAndUnlock(tx, {
          shareId,
          reason: "INSIGHTS_UNAVAILABLE",
          detail,
        }),
      );
    },
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runSnapshotWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
