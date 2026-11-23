import prisma from "../../../prisma/prisma.js";
import { dbCleanupTunables as T } from "../../../constants/workers/DB_CLEANUP.js";
import { deleteInBatches } from "../../helpers/deleteInBatches.js";
import { olderThan } from "../../helpers/olderThan.js";
import { s3Client } from "../../../utils/clients/aws/s3.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { envVariables } from "../../../environment/envVariables.js";

/**
 * Abandoned pending local subaccounts — a create-local flow the advertiser never
 * finished (a DRAFT that was never confirmed) or a confirm that crashed mid-flight
 * (left stuck PROCESSING). Deletes the whole pending graph: the pending-local row,
 * its banner + photo PendingMedia (rows AND their S3 objects), and its orphaned
 * Address.
 *
 * The confirm success/failure paths already clean this up (createLocalConfirm.ts);
 * this is the safety net for the rows those paths never reach. Pending-local media
 * is deliberately excluded from the `stalePendingMedia` rule (it must stay alive
 * while the pending local does), so this rule is its ONLY sweeper — without it the
 * media rows + S3 objects + Address leak forever.
 *
 * Mirrors the confirm failure cleanup: break the banner FK, delete the media,
 * delete the pending local, then delete the now-orphaned address (guarded so an
 * address a real LocalSubaccount adopted is never touched).
 */
export const abandonedPendingLocals = {
  name: "abandoned pending locals (+media +S3)",
  run: () =>
    deleteInBatches({
      batchSize: T.batchSize,
      maxBatches: T.maxBatchesPerCycle,
      findIds: async (take) => {
        const rows = await prisma.pendingLocalSubaccount.findMany({
          where: {
            updatedAt: { lt: olderThan(T.keepAbandonedPendingLocalsMs) },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take,
        });
        return rows.map((r) => r.id);
      },
      hardDelete: async (ids) => {
        // Gather everything to remove before touching FKs. The banner is
        // referenced by `bannerId` on the pending local (no `pendingLocalId`),
        // so its key must be collected explicitly; photos carry `pendingLocalId`.
        const locals = await prisma.pendingLocalSubaccount.findMany({
          where: { id: { in: ids } },
          select: {
            addressId: true,
            bannerId: true,
            banner: { select: { key: true } },
            photos: { select: { key: true } },
          },
        });

        const bannerIds = locals
          .map((l) => l.bannerId)
          .filter((x): x is number => x != null);
        const addressIds = locals.map((l) => l.addressId);
        const s3Keys = locals.flatMap((l) => [
          ...(l.banner?.key ? [l.banner.key] : []),
          ...l.photos.map((p) => p.key),
        ]);

        const deleted = await prisma.$transaction(async (tx) => {
          // 1) Break the banner FK (bannerId -> null) so the banner media can go.
          await tx.pendingLocalSubaccount.updateMany({
            where: { id: { in: ids } },
            data: { bannerId: null },
          });

          // 2) Delete banner + photo media (photos via pendingLocalId, banner by id).
          await tx.pendingMedia.deleteMany({
            where: {
              OR: [{ pendingLocalId: { in: ids } }, { id: { in: bannerIds } }],
            },
          });

          // 3) Delete the pending locals.
          const res = await tx.pendingLocalSubaccount.deleteMany({
            where: { id: { in: ids } },
          });

          // 4) Delete the now-orphaned addresses — but only ones no real local
          //    adopted (defensive; abandoned pending addresses never were).
          await tx.address.deleteMany({
            where: {
              id: { in: addressIds },
              localSubaccount: { is: null },
              pendingLocalSubaccount: { is: null },
            },
          });

          return res.count;
        });

        // 5) Best-effort S3 multi-delete (chunk — S3 deletes max 1000 keys/op).
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
