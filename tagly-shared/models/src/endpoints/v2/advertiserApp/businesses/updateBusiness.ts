import { z } from "zod";
import { AddressSchema } from "../../../../core/geo";
import { EmailSchema } from "../../../../core/email";
import { PhoneSchema } from "../../../../core/phone";
import { BusinessDescriptionSchema } from "../../../../dtos/v2/crossApp/common/businessProfile";
import {
  OpeningHoursPeriodSchema,
  MAX_OPENING_HOURS_PERIODS,
} from "../../../../dtos/v2/crossApp/common/openingHoursPeriod";
import { BusinessOwnerDetailsSchema } from "../../../../dtos/v2/advertiserApp/businesses/businessOwnerDetails";

/**
 * `PATCH /v2/advertisers/me/businesses/:uid` — edit one of the advertiser's
 * own business pages. Runs the exact same pipeline as create: profanity checks
 * on text fields, re-geocode when the address is in the body (with the
 * locale ↔ country invariant), and link changes going through the
 * admin-reviewed `Link` registry (new URLs are created PENDING).
 *
 * Field semantics: **omitted = unchanged, `null` = clear.** `name`, `typeSlug`
 * and `address` are never clearable, so they're optional-only. `openingHours`
 * uses replace-all semantics — when present the stored hours are wiped and
 * rewritten (an empty array clears them); omitted leaves them untouched.
 * Banner/photos are edited via the separate `media/{init,confirm}` pair.
 */
export const UpdateBusinessBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  /** Business type by catalog slug (v2 wire is slug-driven; no numeric ids). */
  typeSlug: z.string().min(1).optional(),
  /** Present ⇒ the address is re-geocoded and replaced as a whole. */
  address: AddressSchema.optional(),
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
    .optional(),
});
export type UpdateBusinessBody = z.infer<typeof UpdateBusinessBodySchema>;

export const UpdateBusinessResponseSchema = z.object({
  /** The full owner detail after the edit — drop it straight into the cache. */
  business: BusinessOwnerDetailsSchema,
});
export type UpdateBusinessResponse = z.infer<
  typeof UpdateBusinessResponseSchema
>;
