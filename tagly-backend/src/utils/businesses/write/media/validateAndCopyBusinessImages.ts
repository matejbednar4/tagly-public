import { AR_TOL } from "../../../../constants/content/MEDIA.js";
import {
  createLocalBannerKey,
  createLocalMediaKey,
} from "../../../aws/s3/helpers/createMediaKeys.js";
import {
  validateAndCopyImages,
  type ImageCopy,
  type PendingImageSlot,
} from "../../../aws/s3/validation/validateAndCopyImages.js";

/**
 * The business-media validate/copy batch shared by create confirm and media
 * update confirm: the banner is 16:9-enforced (± AR_TOL) and EVERY image
 * passes the Rekognition moderation scan inside the validator, then pending
 * keys copy to their PUBLIC keys.
 *
 * Banner + photos run as two concurrent batches — the per-image S3 +
 * Rekognition work dominates the endpoint's latency, so nothing runs
 * serially. allSettled (not all) so a successful batch's keys are still
 * recorded into the CALLER-owned `collect` arrays before the other batch's
 * error is rethrown — on any throw the caller best-effort deletes
 * `collect.copiedKeys` (+ `pendingKeys`) and rethrows, exactly like create
 * confirm always has.
 */
export async function validateAndCopyBusinessImages({
  banner,
  photos,
  metaTag,
  collect,
}: {
  /** Omit when the banner isn't part of this batch (media update keeping it). */
  banner?: PendingImageSlot;
  photos: PendingImageSlot[];
  /** Stamped onto every copied object (e.g. `{ "local-uid": uid }`). */
  metaTag: Record<string, string>;
  /** Caller-owned key sinks — populated even when this call throws. */
  collect: { pendingKeys: string[]; copiedKeys: string[] };
}): Promise<{
  bannerCopy?: ImageCopy;
  photoCopies: ImageCopy[];
}> {
  const [bannerSettled, photosSettled] = await Promise.allSettled([
    banner
      ? validateAndCopyImages({
          pendings: banner,
          validatorOptions: {
            requireAspect: { ratio: 16 / 9, tol: AR_TOL },
          },
          makeFinalKey: (uid, ext) =>
            createLocalBannerKey({ mediaUid: uid, ext, stage: "PUBLIC" }),
          metadataForIndex: () => ({ ...metaTag, slot: "banner" }),
          pathForIndex: () => "banner",
        })
      : Promise.resolve({
          copies: [] as ImageCopy[],
          pendingKeys: [] as string[],
          copiedKeys: [] as string[],
        }),
    // Validate EVERY photo; any failure -> throw so the caller cleans up all.
    validateAndCopyImages({
      pendings: photos,
      validatorOptions: {},
      makeFinalKey: (uid, ext) =>
        createLocalMediaKey({ mediaUid: uid, ext, stage: "PUBLIC" }),
      metadataForIndex: () => ({ ...metaTag, slot: "photo" }),
      // Index within the request's photo batch — the client maps it back to
      // the photos it just submitted (create: all photos; edit: new ones).
      pathForIndex: (i) => `photos.${i}`,
    }),
  ]);

  if (bannerSettled.status === "fulfilled") {
    collect.pendingKeys.push(...bannerSettled.value.pendingKeys);
    collect.copiedKeys.push(...bannerSettled.value.copiedKeys);
  }
  if (photosSettled.status === "fulfilled") {
    collect.pendingKeys.push(...photosSettled.value.pendingKeys);
    collect.copiedKeys.push(...photosSettled.value.copiedKeys);
  }
  if (bannerSettled.status === "rejected") throw bannerSettled.reason;
  if (photosSettled.status === "rejected") throw photosSettled.reason;

  return {
    bannerCopy: banner ? bannerSettled.value.copies[0] : undefined,
    photoCopies: photosSettled.value.copies,
  };
}
