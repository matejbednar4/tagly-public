import { z } from "zod";
import { AddressSchema } from "../../../../core/geo";
import { PresignedUploadSchema } from "../../../../core/presign";
import { SupportedImgMimeSchema } from "../../../../constants/content/SUPPORTED_MIMES";
import { BUSINESS_MAX_PHOTOS } from "../../../../dtos/v2/crossApp/common/businessProfile";

export { BUSINESS_MAX_PHOTOS };

/**
 * `POST /v2/advertisers/me/businesses/init` — phase 1 of creating a business
 * page (local subaccount). Geocodes the address, creates the pending row +
 * pending media slots, and returns presigned S3 POSTs (short expiry — upload
 * immediately, then call confirm). The detail fields (description, links,
 * hours) ride the confirm body, written onto the business atomically at
 * promotion. Search aliases ("tags") are admin-only — never set here.
 */
export const CreateBusinessInitBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Business type by catalog slug (v2 wire is slug-driven; no numeric ids). */
  typeSlug: z.string().min(1),
  address: AddressSchema,
  /** Banner is required (16:9, enforced server-side at confirm). */
  bannerMime: SupportedImgMimeSchema,
  /** One entry per gallery photo being uploaded. */
  photoMimes: z.array(SupportedImgMimeSchema).max(BUSINESS_MAX_PHOTOS).default([]),
});
export type CreateBusinessInitBody = z.infer<
  typeof CreateBusinessInitBodySchema
>;

export const CreateBusinessInitResponseSchema = z.object({
  pendingBusinessId: z.number().int().positive(),
  uploads: z.object({
    banner: PresignedUploadSchema,
    photos: z.array(PresignedUploadSchema).max(BUSINESS_MAX_PHOTOS),
  }),
});
export type CreateBusinessInitResponse = z.infer<
  typeof CreateBusinessInitResponseSchema
>;
