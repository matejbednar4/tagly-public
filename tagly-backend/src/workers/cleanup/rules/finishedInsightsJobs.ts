import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";

/** DONE/FAILED Instagram insights jobs past their retention window. */
export const finishedInsightsJobs = {
  name: "old finished/failed IG insights jobs",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.instagramInsightsQueue.findMany({
          where: {
            status: { in: ["DONE", "FAILED"] },
            OR: [
              { finishedAt: { lt: olderThan(T.keepFinishedIgJobsMs) } },
              {
                finishedAt: null,
                updatedAt: { lt: olderThan(T.keepFinishedIgJobsMs) },
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
          await prisma.instagramInsightsQueue.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    }),
};
