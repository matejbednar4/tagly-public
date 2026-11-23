import { createCustomError } from "../../../core/errors/createCustomError.js";
import { head } from "../helpers/head.js";
import { getImageMeta } from "../helpers/getImageMeta.js";
import { getMediaTypeFromMime } from "../../../formatting/getMediaTypeFromMime.js";
import { ensureMimeMatches } from "../helpers/ensureMimeMatches.js";
import { validateRekognitionImage } from "../../rekognition/validateRekognitionImage.js";

export type ValidateUploadOptions = {
  s3Key: string;
  expectedMime: string;
  maxBytes: number;
  requireAspect?: { ratio: number; tol: number }; // Only applied by the IMAGE validator
  allowFamilyMatch?: boolean;
  enableRekognition?: boolean;
  /**
   * Client-facing slot label ("banner", "photos.2") attached as
   * `errors[].path` on every validation throw, with a machine reason key as
   * `errors[].message` ("tooLarge", "notUploaded", …) — lets clients say
   * WHICH image failed and WHY instead of one generic message.
   */
  pathLabel?: string;
};

export type ValidatedImageUpload = {
  key: string;
  sizeBytes: number;
  actualMime: string;
  mediaType: "IMAGE";
  width: number;
  height: number;
  aspectRatio: number;
};

export async function validatePresignedImageUpload(
  opts: ValidateUploadOptions
): Promise<ValidatedImageUpload> {
  const {
    s3Key,
    expectedMime,
    maxBytes,
    requireAspect,
    allowFamilyMatch = false,
    enableRekognition = true,
    pathLabel,
  } = opts;

  // Slot + machine reason for the client (see ValidateUploadOptions.pathLabel).
  const detail = (reason: string) => ({
    errors: [{ path: pathLabel ?? s3Key, message: reason }],
  });

  // 1) HEAD
  const h = await head(s3Key).catch(() => null);
  if (!h)
    throw createCustomError(5203, "Object not uploaded", {
      status: 410,
      ...detail("notUploaded"),
    });

  const sizeBytes = Number(h.ContentLength ?? 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw createCustomError(5203, "Object size invalid", {
      status: 422,
      ...detail("notUploaded"),
    });
  }
  if (sizeBytes > maxBytes) {
    throw createCustomError(5203, "Object size invalid", {
      status: 422,
      ...detail("tooLarge"),
    });
  }

  const actualMime = (h.ContentType as string | undefined) || expectedMime;
  if (!actualMime)
    throw createCustomError(5204, "Missing Content-Type", {
      status: 422,
      ...detail("invalidImage"),
    });

  try {
    ensureMimeMatches(actualMime, expectedMime, allowFamilyMatch);
  } catch {
    throw createCustomError(5203, "MIME mismatch", {
      status: 422,
      ...detail("invalidImage"),
    });
  }

  const mediaType = getMediaTypeFromMime(actualMime);
  if (mediaType !== "IMAGE") {
    throw createCustomError(5205, "Expected image upload", {
      status: 422,
      ...detail("notImage"),
    });
  }

  // 2) Dimensions (images only)
  const { info } = await getImageMeta(s3Key);
  const w = info?.width,
    hgt = info?.height;
  if (!w || !hgt)
    throw createCustomError(5204, "Invalid image", {
      status: 422,
      ...detail("invalidImage"),
    });

  const ar = Number((w / hgt).toFixed(6));

  if (requireAspect) {
    const { ratio, tol } = requireAspect;
    if (Math.abs(ar - ratio) > tol) {
      throw createCustomError(5205, `Image must be ${ratio.toFixed(6)} AR`, {
        status: 422,
        ...detail("badAspect"),
      });
    }
  }

  // 3) Optional Rekognition: Moderation
  if (enableRekognition) {
    await validateRekognitionImage(s3Key, pathLabel);
  }

  return {
    key: s3Key,
    sizeBytes,
    actualMime,
    mediaType,
    width: w,
    height: hgt,
    aspectRatio: ar,
  };
}
