import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";

/** DONE/FAILED Instagram snapshot jobs past their retention window. */
export const finishedSnapshotJobs = {
  name: "old finished/failed IG snapshot jobs",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.instagramSnapshotQueue.findMany({
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
          await prisma.instagramSnapshotQueue.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    }),
};
