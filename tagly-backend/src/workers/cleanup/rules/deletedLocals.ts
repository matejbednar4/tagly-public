import prisma from "../../../prisma/prisma.js";
import {
  NOT_REJECTED_SHARE_WHERE,
  PROCESSING_SHARE_WHERE,
} from "../../../utils/shares/shareAccess.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";
import { s3Client } from "../../../utils/clients/aws/s3.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { envVariables } from "../../../environment/envVariables.js";

/**
 * Stage 2 of business-page deletion: hard-purge locals the advertiser deleted
 * (`DELETE /v2/advertisers/me/businesses/:uid` flips ACTIVE → DELETED) once
 * BOTH hold:
 *   1. the grace window (`keepDeletedLocalsMs`) has passed — a support/undo
 *      buffer, and
 *   2. the page has NO in-flight share — settlement reads the local live
 *      (`calculateFinalPrice` needs its type/address/geo), so purging earlier
 *      would strand payouts and trap budget locks. "In-flight" =
 *      `status: PROCESSING` that isn't approval-REJECTED (rejection is
 *      terminal but keeps status PROCESSING).
 *
 * Purge choreography (mirrors `deleteAdvertiserAccount`'s local teardown):
 * delete the locals (`Share.localId` SetNull de-links settled shares onto the
 * advertiser — their money truth is snapshotted on the share; OpeningHours +
 * SubsidizationPeriods cascade; Link FKs SetNull, registry rows are shared and
 * stay), then the banner/photo Media rows (deletable once the Restrict-holding
 * local is gone), then the orphaned Address, then best-effort S3.
 */
export const deletedLocals = {
  name: "deleted business pages (+media +S3)",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.localSubaccount.findMany({
          where: {
            status: "DELETED",
            updatedAt: { lt: olderThan(T.keepDeletedLocalsMs) },
            shares: {
              none: {
                ...PROCESSING_SHARE_WHERE,
                ...NOT_REJECTED_SHARE_WHERE,
              },
            },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) => {
        // Gather media rows + S3 keys + addresses before touching anything.
        const locals = await prisma.localSubaccount.findMany({
          where: { id: { in: ids } },
          select: {
            addressId: true,
            bannerId: true,
            banner: { select: { key: true } },
            photos: { select: { id: true, key: true } },
          },
        });

        const mediaIds = locals.flatMap((l) => [
          ...(l.bannerId != null ? [l.bannerId] : []),
          ...l.photos.map((p) => p.id),
        ]);
        const addressIds = locals.map((l) => l.addressId);
        const s3Keys = locals.flatMap((l) => [
          ...(l.banner?.key ? [l.banner.key] : []),
          ...l.photos.map((p) => p.key),
        ]);

        const deleted = await prisma.$transaction(async (tx) => {
          // 1) Delete the locals. Share.localId -> SetNull (settled shares
          //    de-link, keeping their snapshotted money fields); OpeningHours +
          //    SubsidizationPeriods cascade; Link FKs SetNull.
          const res = await tx.localSubaccount.deleteMany({
            where: { id: { in: ids } },
          });

          // 2) Banner + photo media rows (the banner's Restrict FK died with
          //    the local; photo rows were SetNull-detached by the delete).
          if (mediaIds.length) {
            await tx.media.deleteMany({ where: { id: { in: mediaIds } } });
          }

          // 3) Orphaned addresses — guarded so an address any surviving row
          //    still points at is never touched.
          await tx.address.deleteMany({
            where: {
              id: { in: addressIds },
              localSubaccount: { is: null },
              pendingLocalSubaccount: { is: null },
            },
          });

          return res.count;
        });

        // 4) Best-effort S3 multi-delete (chunk — S3 deletes max 1000 keys/op).
        const CHUNK = 800;
        for (let i = 0; i < s3Keys.length; i += CHUNK) {
          try {
            await s3Client.send(
              new DeleteObjectsCommand({
                Bucket: envVariables.S3_BUCKET,
                Delete: {
                  Objects: s3Keys.slice(i, i + CHUNK).map((Key) => ({ Key })),
                },
              }),
            );
          } catch {
            // ignore; the DB rows are already gone
          }
        }

        return deleted;
      },
    }),
};
