import { claimDueJobs, type ClaimContext } from "../../runtime/jobQueue.js";

/** Hydrated snapshot job — only the fields the runner/execute path reads. */
export type SnapshotJob = {
  id: number;
  attempts: number;
  instagram: { customerId: number | null };
  share: { id: number; customerId: number | null } | null;
};

/**
 * FIFO claim: oldest due SCHEDULED snapshot jobs first. Unlike story insights,
 * snapshot jobs have no hard expiry window, so a plain oldest-due-first claim
 * over the shared `claimDueJobs` CAS is all this worker needs. Both share-level
 * and account-level jobs flow through the same queue and are hydrated with the
 * customerId off whichever relation is present.
 */
export async function claimSnapshotJobs(
  ctx: ClaimContext,
): Promise<SnapshotJob[]> {
  const { now, batchSize, leaseMs, table } = ctx;
  return claimDueJobs<SnapshotJob>(table, {
    now,
    batchSize,
    leaseMs,
    where: { scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      attempts: true,
      instagram: { select: { customerId: true } },
      share: { select: { id: true, customerId: true } },
    },
  });
}
