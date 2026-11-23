// Validates + copies pending images to their final keys. Items validate+copy in
// PARALLEL (a serial loop made a 6-image confirm take 15-30s and blow the
// client's request timeout), and a partial failure best-effort deletes the
// copies that already landed instead of orphaning them.
import { getExtensionFromMime } from "../../../formatting/getExtensionFromMime.js";
import { generateUid } from "../../../core/uids/generateUid.js";
import { copyS3ObjectSafe } from "../copyS3ObjectSafe.js";
import { deleteS3KeysOrThrow } from "../deleteS3KeysOrThrow.js";
import {
  validatePresignedImageUpload,
  type ValidateUploadOptions,
  type ValidatedImageUpload,
} from "./validatePresignedImageUpload.js";

export type PendingImageSlot = {
  key: string;
  expectedMime: string;
  expectedMaxBytes: number;
};

export type ImageCopy = {
  finalUid: string;
  finalKey: string;
  v: ValidatedImageUpload;
};

/**
 * Batch validator+copier for image uploads.
 * - Pass ALL batch-level validation in `validatorOptions` (requireAspect, allowFamilyMatch, Rekognition, …)
 * - Per-item fields (s3Key/expectedMime/maxBytes) are overridden automatically.
 */
export async function validateAndCopyImages(opts: {
  pendings: PendingImageSlot | PendingImageSlot[];
  validatorOptions: Omit<
    ValidateUploadOptions,
    "s3Key" | "expectedMime" | "maxBytes"
  >;
  makeFinalKey: (uid: string, ext: string, index: number) => string;
  metadataForIndex?: (
    index: number,
    p: PendingImageSlot
  ) => Record<string, string> | undefined;
  /** Client-facing slot label per item ("banner", "photos.2") — rides the
   * validator's errors[].path so failures name the exact image. */
  pathForIndex?: (index: number) => string;
}): Promise<{
  copies: ImageCopy[];
  pendingKeys: string[];
  copiedKeys: string[];
}> {
  const { validatorOptions, makeFinalKey, metadataForIndex, pathForIndex } =
    opts;
  const list = Array.isArray(opts.pendings) ? opts.pendings : [opts.pendings];
  if (!list.length) return { copies: [], pendingKeys: [], copiedKeys: [] };

  // Items are independent (each is its own S3 HEAD/GET + Rekognition + COPY),
  // so run the whole batch concurrently — batches are small (banner + a handful
  // of photos), no concurrency limiter needed.
  const settled = await Promise.allSettled(
    list.map(async (p, i) => {
      const v = await validatePresignedImageUpload({
        ...validatorOptions, // batch-level policy (requireAspect, faces/moderation, etc.)
        s3Key: p.key, // overridden per item
        expectedMime: p.expectedMime, // overridden per item
        maxBytes: p.expectedMaxBytes, // overridden per item
        ...(pathForIndex ? { pathLabel: pathForIndex(i) } : {}),
      });

      const finalUid = generateUid("MEDIA");
      const ext = getExtensionFromMime(v.actualMime);
      const finalKey = makeFinalKey(finalUid, ext, i);

      await copyS3ObjectSafe({
        srcKey: v.key,
        dstKey: finalKey,
        contentType: v.actualMime,
        metadata: metadataForIndex?.(i, p),
      });

      return {
        copy: { finalUid, finalKey, v } satisfies ImageCopy,
        pendingKey: p.key,
        copiedKey: finalKey,
      };
    })
  );

  const firstFailure = settled.find((s) => s.status === "rejected");
  if (firstFailure) {
    // A throw loses the return value, so the caller can never clean up copies
    // from the items that DID succeed — delete them here before rethrowing.
    const landedCopies = settled.flatMap((s) =>
      s.status === "fulfilled" ? [s.value.copiedKey] : []
    );
    if (landedCopies.length) {
      await deleteS3KeysOrThrow(landedCopies).catch(() => {});
    }
    throw (firstFailure as PromiseRejectedResult).reason;
  }

  const results = settled.map(
    (s) => (s as PromiseFulfilledResult<{ copy: ImageCopy; pendingKey: string; copiedKey: string }>).value
  );
  return {
    copies: results.map((r) => r.copy),
    pendingKeys: results.map((r) => r.pendingKey),
    copiedKeys: results.map((r) => r.copiedKey),
  };
}
