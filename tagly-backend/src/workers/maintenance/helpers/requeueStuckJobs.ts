import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { JobQueueDelegate } from "../../runtime/jobQueue.js";
import { sampleIds } from "../../helpers/sampleIds.js";

/**
 * Requeue jobs stuck in PROCESSING past their `processingDeadline` back to
 * SCHEDULED so the queue worker re-claims them (the row's worker died mid-flight
 * after the lease expired). Shared by the notification, insights, and snapshot
 * requeue tasks — all three `jobs.*Queue` tables carry the identical
 * `status`/`startedAt`/`processingDeadline` columns, so the sweep is written once.
 *
 * `extraWhere` narrows the scan further (the insights task only requeues jobs
 * still inside their `validUntil` TTL). Idempotent — a partial run just picks the
 * rest up next cycle. Returns the number of jobs requeued.
 */
export async function requeueStuckJobs({
  tag,
  queue,
  now,
  batchSize,
  log,
  extraWhere,
}: {
  /** Short log tag, e.g. "NOTIF" / "INSIGHTS" / "SNAPSHOT". */
  tag: string;
  queue: JobQueueDelegate;
  now: Date;
  batchSize: number;
  log: WorkerLogger;
  extraWhere?: Record<string, unknown>;
}): Promise<number> {
  const stuck: Array<{ id: number }> = await queue.findMany({
    where: {
      status: "PROCESSING",
      processingDeadline: { lt: now },
      ...extraWhere,
    },
    take: batchSize,
    select: { id: true },
  });

  if (stuck.length === 0) return 0;

  const ids = stuck.map((j) => j.id);
  log.info(`(${tag}) picked ${ids.length} stuck jobs (ids: ${sampleIds(ids)})`);

  const t0 = Date.now();
  const res = await queue.updateMany({
    where: { id: { in: ids } },
    data: { status: "SCHEDULED", startedAt: null, processingDeadline: null },
  });
  log.info(
    `(${tag}) requeued ${res.count}/${ids.length} jobs in ${Date.now() - t0}ms`,
  );

  return res.count;
}
