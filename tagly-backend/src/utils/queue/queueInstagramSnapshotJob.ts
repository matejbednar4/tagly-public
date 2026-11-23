import { JobStatus, Prisma } from "../../generated/prisma/client.js";

/**
 * Queue a snapshot job for an Instagram account by inserting an
 * `InstagramSnapshotQueue` row, drained by the IG snapshot worker (the queue
 * is shared runtime infra).
 *
 * Idempotent: if a SCHEDULED job already exists for this instagramId (and
 * optional shareId), the existing job is returned without creating a duplicate.
 */
export async function queueInstagramSnapshotJob(params: {
  shareId?: number;
  instagramId: number;
  tx: Prisma.TransactionClient;
  scheduledAt: Date;
  processingDeadline?: Date;
}) {
  const { shareId, instagramId, scheduledAt, processingDeadline, tx } = params;

  // Check if already scheduled
  const existing = await tx.instagramSnapshotQueue.findFirst({
    where: {
      instagramId,
      shareId: shareId ?? null,
      status: JobStatus.SCHEDULED,
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      processingDeadline: true,
    },
  });

  if (existing) {
    return existing; // Idempotent: don't create duplicates
  }

  return tx.instagramSnapshotQueue.create({
    data: {
      shareId: shareId ?? null,
      instagramId,
      scheduledAt,
      processingDeadline: processingDeadline ?? null,
      status: JobStatus.SCHEDULED,
      attempts: 0,
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      processingDeadline: true,
    },
  });
}
