import prisma from "../../../prisma/prisma.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { JobQueueDelegate } from "../../runtime/jobQueue.js";
import { requeueStuckJobs } from "../helpers/requeueStuckJobs.js";
import type { MaintenanceTask } from "./index.js";

/** Notification jobs stuck in PROCESSING past their deadline → back to SCHEDULED. */
export const requeueStuckNotificationJobs: MaintenanceTask = {
  name: "requeue stuck notification jobs",
  run: async ({ now, log }) => {
    await requeueStuckJobs({
      tag: "NOTIF",
      queue: prisma.notificationQueue as unknown as JobQueueDelegate,
      now,
      batchSize: T.fetchBatchSize,
      log,
    });
  },
};
