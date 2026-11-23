import prisma from "../../../prisma/prisma.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { JobQueueDelegate } from "../../runtime/jobQueue.js";
import { requeueStuckJobs } from "../helpers/requeueStuckJobs.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Instagram insights jobs stuck in PROCESSING past their deadline → back to
 * SCHEDULED. Requeue two classes: no-TTL POST/REEL jobs (`validUntil IS NULL`,
 * no collection window) and story jobs still inside their `validUntil` TTL.
 * Genuinely-expired story jobs (`validUntil < now`) are deliberately excluded
 * here — `expireInsightsJobs` fails those and unlocks their budget instead.
 *
 * The `validUntil IS NULL` arm is load-bearing: the insights queue worker only
 * ever claims SCHEDULED rows, so a POST/REEL job whose worker died mid-flight is
 * recovered by nobody but this task — omit it and the share never pays and its
 * advertiser budget lock is stranded forever.
 */
export const requeueStuckInsightsJobs: MaintenanceTask = {
  name: "requeue stuck insights jobs",
  run: async ({ now, log }) => {
    await requeueStuckJobs({
      tag: "INSIGHTS",
      queue: prisma.instagramInsightsQueue as unknown as JobQueueDelegate,
      now,
      batchSize: T.fetchBatchSize,
      log,
      // No-TTL (POST/REEL) OR story still within its window. Expired stories go
      // to expireInsightsJobs.
      extraWhere: { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    });
  },
};
