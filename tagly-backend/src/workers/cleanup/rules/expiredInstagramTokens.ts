import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";

/** Instagram tokens whose `expiresAt` is already in the past. */
export const expiredInstagramTokens = {
  name: "expired instagram tokens",
  run: (now: Date) =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.instagramToken.findMany({
          where: { expiresAt: { lt: now } },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (
          await prisma.instagramToken.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    }),
};
