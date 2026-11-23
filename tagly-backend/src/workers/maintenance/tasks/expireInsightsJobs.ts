import prisma from "../../../prisma/prisma.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { markShareUnpayableAndUnlock } from "../../../utils/shares/markShareUnpayableAndUnlock.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { sampleIds } from "../../helpers/sampleIds.js";
import type { MaintenanceTask } from "./index.js";

const WINDOW_EXPIRED_REASON =
  "Insights collection window expired (story >24h old)";

/**
 * Fail insights jobs whose `validUntil` TTL has passed. Story shares have a
 * 24-hour window for insights collection; if the job wasn't processed in time we
 * fail it, mark a still-in-flight share UNPAYABLE, and unlock its locked budget.
 *
 * Per-job transaction so one bad job doesn't roll back the rest; a per-job throw
 * is reported and the loop continues.
 */
export const expireInsightsJobs: MaintenanceTask = {
  name: "expire insights jobs",
  run: async ({ now, log }) => {
    const expiredInsights = await prisma.instagramInsightsQueue.findMany({
      where: {
        status: { in: ["SCHEDULED", "PROCESSING"] },
        validUntil: { lt: now }, // TTL has passed
      },
      take: T.fetchBatchSize,
      select: {
        id: true,
        share: { select: { id: true } },
      },
    });

    if (expiredInsights.length === 0) return;

    const ids = expiredInsights.map((j) => j.id);
    log.info(
      `(EXPIRED_INSIGHTS) found ${ids.length} expired jobs (ids: ${sampleIds(ids)})`,
    );

    const t0 = Date.now();
    let failed = 0;
    let sharesMarkedUnpayable = 0;

    for (const job of expiredInsights) {
      try {
        await prisma.$transaction(async (tx) => {
          // Mark job as FAILED
          await tx.instagramInsightsQueue.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              finishedAt: now,
              lastError: WINDOW_EXPIRED_REASON,
            },
          });

          // Void a still-in-flight share + release whatever pool it locked, via
          // the single shared implementation: a PROCESSING-guarded flip to
          // UNPAYABLE plus the correct-pool unlock read from the SHARE_LOCK
          // event. Terminal shares (PAID/UNPAYABLE) flip nothing (`voided:
          // false`); a REJECTED-but-PROCESSING share still flips — harmless, the
          // customer status derives REJECTED.
          if (job.share) {
            const { voided } = await markShareUnpayableAndUnlock(tx, {
              shareId: job.share.id,
              reason: "INSIGHTS_UNAVAILABLE",
              detail: WINDOW_EXPIRED_REASON,
            });
            if (voided) sharesMarkedUnpayable++;
          }
        });

        failed++;
      } catch (e) {
        reportWorkerError(e, {
          worker: "maintenance",
          phase: "task",
          task: "expireInsightsJobs",
          jobId: job.id,
          shareId: job.share?.id,
        });
      }
    }

    log.info(
      `(EXPIRED_INSIGHTS) failed ${failed}/${ids.length} jobs, ` +
        `marked ${sharesMarkedUnpayable} shares UNPAYABLE in ${Date.now() - t0}ms`,
    );
  },
};
