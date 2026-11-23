import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";
import { s3Client } from "../../../utils/clients/aws/s3.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { envVariables } from "../../../environment/envVariables.js";

/**
 * Stale pending media not attached to anything (not a pending-local banner, not
 * a pending-local photo). Deletes the S3 objects as well as the DB rows.
 */
export const stalePendingMedia = {
  name: "stale pending media (+S3)",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.pendingMedia.findMany({
          where: {
            updatedAt: { lt: olderThan(T.keepPendingMediaMs) },
            bannerOfPendingLocal: null,
            pendingLocalId: null,
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) => {
        const rows = await prisma.pendingMedia.findMany({
          where: { id: { in: ids } },
          select: { key: true },
        });
        const keys = rows.map((r) => r.key).filter(Boolean);

        // Best-effort S3 multi-delete (chunk — S3 deletes max 1000 keys/op).
        const CHUNK = 800;
        for (let i = 0; i < keys.length; i += CHUNK) {
          try {
            await s3Client.send(
              new DeleteObjectsCommand({
                Bucket: envVariables.S3_BUCKET,
                Delete: {
                  Objects: keys.slice(i, i + CHUNK).map((Key) => ({ Key })),
                },
              }),
            );
          } catch {
            // ignore; we'll still delete the DB rows
          }
        }

        return (
          await prisma.pendingMedia.deleteMany({ where: { id: { in: ids } } })
        ).count;
      },
    }),
};
