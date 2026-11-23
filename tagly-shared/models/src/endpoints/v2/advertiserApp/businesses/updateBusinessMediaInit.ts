import { z } from "zod";
import { MediaUidSchema } from "../../../../core/uids";
import { PresignedUploadSchema } from "../../../../core/presign";
import { SupportedImgMimeSchema } from "../../../../constants/content/SUPPORTED_MIMES";
import { BUSINESS_MAX_PHOTOS } from "../../../../dtos/v2/crossApp/common/businessProfile";

/**
 * `POST /v2/advertisers/me/businesses/:uid/media/init` — phase 1 of editing a
 * business page's banner/photos. Declares what's being uploaded (a replacement
 * banner and/or new gallery photos) plus which existing photos are kept, and
 * returns presigned S3 POSTs (short expiry — upload immediately, then call
 * confirm). Existing photos are never re-uploaded — they're kept by uid.
 *
 * A pure removal (no new uploads) needs no init at all — call confirm directly
 * with the reduced `keepPhotoUids`.
 */
export const UpdateBusinessMediaInitBodySchema = z
  .object({
    /** Present ⇒ the banner is being replaced (16:9, enforced at confirm). */
    newBannerMime: SupportedImgMimeSchema.optional(),
    /** One entry per new gallery photo being uploaded. */
    newPhotoMimes: z
      .array(SupportedImgMimeSchema)
      .max(BUSINESS_MAX_PHOTOS)
      .default([]),
    /** Uids of existing gallery photos the owner is keeping. */
    keepPhotoUids: z.array(MediaUidSchema).max(BUSINESS_MAX_PHOTOS).default([]),
  })
  .refine((b) => b.newBannerMime != null || b.newPhotoMimes.length > 0, {
    message: "Nothing to upload — pure removals go straight to confirm",
  });
export type UpdateBusinessMediaInitBody = z.infer<
  typeof UpdateBusinessMediaInitBodySchema
>;

export const UpdateBusinessMediaInitResponseSchema = z.object({
  uploads: z.object({
    banner: PresignedUploadSchema.optional(),
    photos: z.array(PresignedUploadSchema).max(BUSINESS_MAX_PHOTOS),
  }),
});
export type UpdateBusinessMediaInitResponse = z.infer<
  typeof UpdateBusinessMediaInitResponseSchema
>;
