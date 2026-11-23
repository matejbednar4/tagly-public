import {
  JobStatus,
  Prisma,
} from "../../generated/prisma/client.js";

/**
 * One insights job per share (enforced by unique shareId).
 * If a row exists:
 *  - if DONE/PROCESSING, we don't touch it (idempotent).
 *  - if SCHEDULED with later time, we can pull it earlier.
 */
export async function queueInstagramInsightsJob(params: {
  shareId: number;
  tx: Prisma.TransactionClient;
  scheduledAt: Date; // e.g., postedToIgAt + 23h30m (STORY_INSIGHTS_SCHEDULE)
  validUntil?: Date; // e.g., story postedToIgAt + 24h
  forceEarlier?: boolean; // allow moving earlier if already scheduled later
}) {
  const { shareId, scheduledAt, forceEarlier = true, validUntil, tx } = params;

  const existing = await tx.instagramInsightsQueue.findUnique({
    where: { shareId },
    select: { id: true, status: true, scheduledAt: true },
  });

  if (!existing) {
    return tx.instagramInsightsQueue.create({
      data: {
        shareId,
        scheduledAt,
        validUntil,
        status: JobStatus.SCHEDULED,
        attempts: 0, // mapped from retry_count in DB
      },
    });
  }

  // Idempotent behavior:
  if (
    existing.status === JobStatus.DONE ||
    existing.status === JobStatus.PROCESSING
  ) {
    return existing; // nothing to do
  }

  // If already scheduled later, optionally pull it earlier
  if (forceEarlier && existing.scheduledAt > scheduledAt) {
    return tx.instagramInsightsQueue.update({
      where: { shareId },
      data: { scheduledAt, status: JobStatus.SCHEDULED },
    });
  }

  // Otherwise leave as-is
  return existing;
}
