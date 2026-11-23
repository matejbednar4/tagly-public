import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import {
  promoteOnePendingMedia,
  promotePendingMedia,
} from "../../aws/s3/promotePendingMedia.js";
import { deleteS3KeysOrThrow } from "../../aws/s3/deleteS3KeysOrThrow.js";
import { validateAndCopyBusinessImages } from "./media/validateAndCopyBusinessImages.js";
import {
  businessNotFoundError,
  businessWriteScopeWhere,
  type BusinessWriteActor,
} from "./businessWriteActor.js";
import { BUSINESS_MAX_PHOTOS } from "@tagly/models/v2/crossApp";
import type { UpdateBusinessMediaConfirmBody } from "@tagly/models/v2/advertiserApp";

/**
 * Phase 2 of editing a business page's banner/photos — the shared
 * orchestration behind the advertiser endpoint (`POST /v2/advertisers/me/
 * businesses/:uid/media/confirm`) and its admin twin (`POST /v2/admin/
 * businesses/:uid/media/confirm`). Keep-by-uid semantics: `keepPhotoUids` is
 * the authoritative keep list — every current photo NOT in it is removed.
 * A pure removal calls confirm directly (no init, no pending ids). Returns
 * the edited `localId`; each controller hydrates its own DTO. Actor
 * differences are only the lookup scope + not-found code
 * (`businessWriteActor.ts`).
 *
 * Flow (media validation shared with create):
 * 1. Scope check; validate keep uids + pending rows (`pendingLocalId: null`
 *    guarantees they came from media init, not a create flow; purpose checks
 *    per slot) + final photo count.
 * 2. Validate + copy the new uploads (banner 16:9 ± AR_TOL, every image
 *    through the Rekognition moderation scan) — same 5205/5210 failures as
 *    create, so a flagged image on EDIT is refused exactly like on create.
 * 3. Atomic tx: promote new media, swap the banner, connect new photos,
 *    disconnect + delete removed photo rows, delete the replaced banner row,
 *    delete consumed pending rows. A concurrent-confirm count guard rolls
 *    everything back rather than exceeding the photo cap.
 * 4. Post-commit best-effort S3 delete of pending keys + replaced/removed
 *    keys; on failure, cleanup of copied keys + pending rows.
 *
 * Concurrency note: writes only banner/photos — disjoint from the PATCH
 * flow's columns, so an interleaved PATCH can't be lost.
 */
export async function updateBusinessMediaConfirmCore(
  actor: BusinessWriteActor,
  uid: string,
  body: UpdateBusinessMediaConfirmBody,
): Promise<{ localId: number }> {
  const {
    pendingBannerId,
    pendingPhotoIds = [],
    keepPhotoUids = [],
  } = body;

  const local = await prisma.localSubaccount.findFirst({
    where: businessWriteScopeWhere(actor, uid),
    select: {
      id: true,
      banner: { select: { id: true, key: true } },
      photos: { select: { id: true, uid: true, key: true } },
    },
  });
  if (!local) throw businessNotFoundError(actor);

  const existingPhotoUids = new Set(local.photos.map((p) => p.uid));
  for (const keepUid of keepPhotoUids) {
    if (!existingPhotoUids.has(keepUid)) {
      throw createCustomError(5203, `Unknown photo uid: ${keepUid}`, 400);
    }
  }

  // Load + validate the pending rows (must be free-floating update uploads).
  const pendingIds = [
    ...(pendingBannerId ? [pendingBannerId] : []),
    ...pendingPhotoIds,
  ];
  const pendings = pendingIds.length
    ? await prisma.pendingMedia.findMany({
        where: { id: { in: pendingIds }, pendingLocalId: null },
        select: {
          id: true,
          key: true,
          expectedMime: true,
          expectedMaxBytes: true,
          purpose: true,
        },
      })
    : [];
  if (pendings.length !== pendingIds.length) {
    throw createCustomError(5203, "Some pending items not found", 400);
  }
  const bannerPending = pendingBannerId
    ? pendings.find((p) => p.id === pendingBannerId)
    : undefined;
  if (pendingBannerId && bannerPending?.purpose !== "LOCAL_BANNER") {
    throw createCustomError(5203, "Pending banner has invalid purpose", 400);
  }
  const photoPendings = pendings.filter((p) => pendingPhotoIds.includes(p.id));
  if (photoPendings.some((p) => p.purpose !== "LOCAL_PHOTO")) {
    throw createCustomError(
      5203,
      "One or more pending photos have invalid purpose",
      400,
    );
  }

  if (keepPhotoUids.length + photoPendings.length > BUSINESS_MAX_PHOTOS) {
    throw createCustomError(
      5206,
      `A business can have at most ${BUSINESS_MAX_PHOTOS} photos`,
      400,
    );
  }

  // Photos being removed = current minus the keep list.
  const keepSet = new Set(keepPhotoUids);
  const removedPhotos = local.photos.filter((p) => !keepSet.has(p.uid));
  const oldBannerKey = bannerPending ? local.banner?.key : undefined;
  const oldBannerId = bannerPending ? local.banner?.id : undefined;

  const pendingKeys: string[] = [];
  const copiedFinalKeys: string[] = [];

  try {
    const { bannerCopy, photoCopies } = await validateAndCopyBusinessImages({
      banner: bannerPending
        ? {
            key: bannerPending.key,
            expectedMime: bannerPending.expectedMime,
            expectedMaxBytes: bannerPending.expectedMaxBytes,
          }
        : undefined,
      photos: photoPendings.map((p) => ({
        key: p.key,
        expectedMime: p.expectedMime,
        expectedMaxBytes: p.expectedMaxBytes,
      })),
      metaTag: { "local-uid": uid },
      collect: { pendingKeys, copiedKeys: copiedFinalKeys },
    });

    // ---- ATOMIC DB COMMIT ----
    await prisma.$transaction(async (tx) => {
      const newBannerId = bannerCopy
        ? await promoteOnePendingMedia(tx, bannerCopy)
        : null;
      const newPhotoIds = await promotePendingMedia(tx, photoCopies);

      await tx.localSubaccount.update({
        where: { id: local.id },
        data: {
          ...(newBannerId ? { banner: { connect: { id: newBannerId } } } : {}),
          photos: {
            ...(removedPhotos.length
              ? { disconnect: removedPhotos.map((p) => ({ id: p.id })) }
              : {}),
            ...(newPhotoIds.length
              ? { connect: newPhotoIds.map((id) => ({ id })) }
              : {}),
          },
        },
      });

      if (removedPhotos.length) {
        await tx.media.deleteMany({
          where: { id: { in: removedPhotos.map((p) => p.id) } },
        });
      }
      // Old banner row is deletable now that the local points at the new one.
      if (newBannerId && oldBannerId) {
        await tx.media.delete({ where: { id: oldBannerId } });
      }
      if (pendingIds.length) {
        await tx.pendingMedia.deleteMany({
          where: { id: { in: pendingIds } },
        });
      }

      // Concurrent-confirm guard: never exceed the cap — roll back instead.
      const after = await tx.localSubaccount.findUnique({
        where: { id: local.id },
        select: { photos: { select: { id: true } } },
      });
      if ((after?.photos.length ?? 0) > BUSINESS_MAX_PHOTOS) {
        throw createCustomError(5206, "Too many photos after update", 409);
      }
    });

    // ---- SUCCESS CLEANUP (best-effort) ----
    await deleteS3KeysOrThrow([
      ...pendingKeys,
      ...(oldBannerKey ? [oldBannerKey] : []),
      ...removedPhotos.map((p) => p.key),
    ]).catch(() => {});

    return { localId: local.id };
  } catch (err) {
    // ---- FAILURE CLEANUP (best-effort) ----
    await deleteS3KeysOrThrow([...copiedFinalKeys, ...pendingKeys]).catch(
      () => {},
    );
    if (pendingIds.length) {
      await prisma.pendingMedia
        .deleteMany({ where: { id: { in: pendingIds } } })
        .catch(() => {});
    }
    throw err;
  }
}
