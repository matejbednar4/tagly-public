import { z } from "zod";
import { MediaUidSchema } from "../../../../core/uids";
import { BUSINESS_MAX_PHOTOS } from "../../../../dtos/v2/crossApp/common/businessProfile";
import { BusinessOwnerDetailsSchema } from "../../../../dtos/v2/advertiserApp/businesses/businessOwnerDetails";

/**
 * `POST /v2/advertisers/me/businesses/:uid/media/confirm` — phase 2 of editing
 * a business page's banner/photos. Validates the uploaded media (banner 16:9 +
 * moderation scan, same as create), then atomically swaps the banner, attaches
 * the new photos, and removes every existing photo NOT in `keepPhotoUids`.
 *
 * `keepPhotoUids` here is the authoritative keep list (init's copy is only a
 * count pre-check). A pure removal calls confirm directly with no pending ids.
 */
export const UpdateBusinessMediaConfirmBodySchema = z.object({
  /** Pending id of the replacement banner from init (omit to keep the banner). */
  pendingBannerId: z.number().int().positive().optional(),
  /** Pending ids of the new gallery photos from init, in display order. */
  pendingPhotoIds: z
    .array(z.number().int().positive())
    .max(BUSINESS_MAX_PHOTOS)
    .default([]),
  /** Uids of existing gallery photos to keep — everything else is removed. */
  keepPhotoUids: z.array(MediaUidSchema).max(BUSINESS_MAX_PHOTOS).default([]),
});
export type UpdateBusinessMediaConfirmBody = z.infer<
  typeof UpdateBusinessMediaConfirmBodySchema
>;

export const UpdateBusinessMediaConfirmResponseSchema = z.object({
  /** The full owner detail after the swap — drop it straight into the cache. */
  business: BusinessOwnerDetailsSchema,
});
export type UpdateBusinessMediaConfirmResponse = z.infer<
  typeof UpdateBusinessMediaConfirmResponseSchema
>;
