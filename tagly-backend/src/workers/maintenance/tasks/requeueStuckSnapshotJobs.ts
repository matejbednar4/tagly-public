import prisma from "../../../prisma/prisma.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { JobQueueDelegate } from "../../runtime/jobQueue.js";
import { requeueStuckJobs } from "../helpers/requeueStuckJobs.js";
import type { MaintenanceTask } from "./index.js";

/** Snapshot jobs stuck in PROCESSING past their deadline → back to SCHEDULED. */
export const requeueStuckSnapshotJobs: MaintenanceTask = {
  name: "requeue stuck snapshot jobs",
  run: async ({ now, log }) => {
    await requeueStuckJobs({
      tag: "SNAPSHOT",
      queue: prisma.instagramSnapshotQueue as unknown as JobQueueDelegate,
      now,
      batchSize: T.fetchBatchSize,
      log,
    });
  },
};
