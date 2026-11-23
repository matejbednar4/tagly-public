import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";

/** DONE/FAILED notification jobs past their retention window. */
export const finishedNotificationJobs = {
  name: "old finished/failed notification jobs",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.notificationQueue.findMany({
          where: {
            status: { in: ["DONE", "FAILED"] },
            OR: [
              {
                finishedAt: { lt: olderThan(T.keepFinishedNotificationJobsMs) },
              },
              {
                finishedAt: null,
                updatedAt: { lt: olderThan(T.keepFinishedNotificationJobsMs) },
              },
            ],
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (
          await prisma.notificationQueue.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    }),
};
