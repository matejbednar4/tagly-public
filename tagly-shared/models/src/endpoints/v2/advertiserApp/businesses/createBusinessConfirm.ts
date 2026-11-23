import { z } from "zod";
import { EmailSchema } from "../../../../core/email";
import { PhoneSchema } from "../../../../core/phone";
import { BusinessDescriptionSchema } from "../../../../dtos/v2/crossApp/common/businessProfile";
import {
  OpeningHoursPeriodSchema,
  MAX_OPENING_HOURS_PERIODS,
} from "../../../../dtos/v2/crossApp/common/openingHoursPeriod";
import { BusinessOwnerPreviewSchema } from "../../../../dtos/v2/advertiserApp/businesses/businessOwnerPreview";

/**
 * `POST /v2/advertisers/me/businesses/confirm` — phase 2: validates the
 * uploaded media (banner 16:9 + moderation scan), promotes the pending row to
 * a live business page, and writes the optional detail fields in the same
 * transaction. Web links go through the admin-reviewed `Link` model (created
 * PENDING; shown to customers only once APPROVED).
 */
export const CreateBusinessConfirmBodySchema = z.object({
  pendingBusinessId: z.number().int().positive(),

  // Detail step — everything optional. Kept client-side between wizard steps
  // and written at promotion so creation stays a single atomic commit.
  description: BusinessDescriptionSchema.min(1).nullish(),
  instagramTag: z.string().trim().min(1).max(60).nullish(),
  websiteUrl: z.url().nullish(),
  reservationUrl: z.url().nullish(),
  menuUrl: z.url().nullish(),
  phoneNumber: PhoneSchema.nullish(),
  contactEmail: EmailSchema.nullish(),
  openingHours: z
    .array(OpeningHoursPeriodSchema)
    .max(MAX_OPENING_HOURS_PERIODS)
    .default([]),
});
export type CreateBusinessConfirmBody = z.infer<
  typeof CreateBusinessConfirmBodySchema
>;

export const CreateBusinessConfirmResponseSchema = z.object({
  business: BusinessOwnerPreviewSchema,
});
export type CreateBusinessConfirmResponse = z.infer<
  typeof CreateBusinessConfirmResponseSchema
>;
