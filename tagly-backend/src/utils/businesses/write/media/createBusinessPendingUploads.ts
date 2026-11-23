import type { Prisma } from "../../../../generated/prisma/client.js";
import { generateUid } from "../../../core/uids/generateUid.js";
import { envVariables } from "../../../../environment/envVariables.js";
import {
  MAX_IMG_BANNER_SIZE,
  MAX_IMG_PHOTO_SIZE,
} from "../../../../constants/content/MEDIA.js";
import {
  createLocalBannerKey,
  createLocalMediaKey,
} from "../../../aws/s3/helpers/createMediaKeys.js";
import { getExtensionFromMime } from "../../../formatting/getExtensionFromMime.js";
import { presignUploadToS3 } from "../../../aws/s3/presignUploadToS3.js";

export type BusinessPendingMediaRow = {
  id: number;
  key: string;
  expectedMime: string;
  expectedMaxBytes: number;
};

/**
 * Create one `PendingMedia` row for a business banner or gallery photo — the
 * shared slot factory behind both create (rows attached to a
 * `pendingLocalId`) and media update (free-floating rows; the
 * `stalePendingMedia` cleanup rule reaps abandoned ones after 24h). Owns the
 * pending S3 key shape and the per-purpose size limits so every business
 * upload path stays identical.
 */
export async function createBusinessPendingMedia(
  tx: Prisma.TransactionClient,
  {
    purpose,
    mime,
    pendingLocalId,
  }: {
    purpose: "LOCAL_BANNER" | "LOCAL_PHOTO";
    mime: string;
    /** Attach photos to a pending business (create); omit to float free (update). */
    pendingLocalId?: number;
  },
): Promise<BusinessPendingMediaRow> {
  const ext = getExtensionFromMime(mime);
  const tempUid = generateUid("MEDIA"); // throwaway for the pending key
  const key =
    purpose === "LOCAL_BANNER"
      ? createLocalBannerKey({ mediaUid: tempUid, ext, stage: "PENDING" })
      : createLocalMediaKey({ mediaUid: tempUid, ext, stage: "PENDING" });

  const pm = await tx.pendingMedia.create({
    data: {
      uid: tempUid,
      purpose,
      expectedMime: mime,
      expectedMaxBytes:
        purpose === "LOCAL_BANNER" ? MAX_IMG_BANNER_SIZE : MAX_IMG_PHOTO_SIZE,
      bucket: envVariables.S3_BUCKET,
      key,
      pendingLocalId: pendingLocalId ?? null,
    },
    select: { id: true, key: true, expectedMime: true, expectedMaxBytes: true },
  });
  return pm;
}

/**
 * Presign the S3 POST for a business pending-media row, returning the wire
 * `PresignedUpload` shape (`pendingMediaId` + key + url/fields + limits).
 * Runs outside any transaction (network call).
 */
export async function presignBusinessPendingUpload(
  pm: BusinessPendingMediaRow,
  {
    meta,
    slot,
  }: {
    meta: Record<string, string>;
    slot: string;
  },
): Promise<{
  pendingMediaId: number;
  key: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
  slot: string;
}> {
  const presign = await presignUploadToS3({
    key: pm.key,
    maxBytes: pm.expectedMaxBytes,
    contentType: pm.expectedMime,
    meta: { ...meta, slot },
    startsWithContentType: "image/",
  });
  return {
    pendingMediaId: pm.id,
    key: pm.key,
    url: presign.url,
    fields: presign.fields,
    maxBytes: pm.expectedMaxBytes,
    slot,
  };
}
