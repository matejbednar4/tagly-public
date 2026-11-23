import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";

/** Push tokens that have been disabled (customer + advertiser). */
export const disabledPushTokens = {
  name: "disabled push tokens",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.pushToken.findMany({
          where: { disabledAt: { not: null } },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) =>
        (await prisma.pushToken.deleteMany({ where: { id: { in: ids } } }))
          .count,
    }),
};
