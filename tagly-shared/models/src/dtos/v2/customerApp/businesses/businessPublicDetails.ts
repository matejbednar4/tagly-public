import { z } from "zod";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { GeoAddressSchema } from "../../../../core/geo";
import {
  BusinessDescriptionSchema,
  BUSINESS_MAX_PHOTOS,
} from "../../crossApp/common/businessProfile";
import { EmailSchema } from "../../../../core/email";
import { PhoneSchema } from "../../../../core/phone";
import { InstagramTagSchema } from "../../../../core/instagram";
import { BusinessPublicPreviewSchema } from "./businessPublicPreview";
import { OpeningHoursPeriodSchema } from "../../crossApp/common/openingHoursPeriod";

/**
 * A business (local subaccount) detail view as shown to a customer (the public,
 * non-owner shape) — the `BusinessPublicPreview` (identity + reward estimate)
 * plus the extra fields a detail page shows. Fetched by uid
 * (`GET /v2/customers/businesses/:uid`).
 */
export const BusinessPublicDetailsSchema = BusinessPublicPreviewSchema.extend({
  /** Gallery photos (beyond the banner). */
  photos: z.array(MediaPreviewSchema).max(BUSINESS_MAX_PHOTOS),

  /**
   * Full address (overrides the preview's city/street/location-only shape) —
   * adds country/region/zip for a complete address block + directions.
   */
  address: GeoAddressSchema,

  /**
   * Instagram handle (normalized, no leading "@"). Null when the business has no
   * linked handle. The preview omits this as map/search-irrelevant; the detail
   * page surfaces it as the handle to tag / view on Instagram.
   */
  instagramTag: InstagramTagSchema,

  /**
   * The full set of tags a story must show at least one of to validate a share:
   * the business name, its keyword tags, and its `@handle`. Built server-side by
   * `getLocalShareTags` (always includes the name, so it's never empty).
   */
  tags: z.array(z.string()),

  /**
   * Short "about the business" blurb (trimmed, capped at
   * BUSINESS_DESCRIPTION_MAX_LENGTH). Null when the business hasn't set one.
   */
  description: BusinessDescriptionSchema.nullable(),
  /** Marketing/website URL. Null when unset. */
  websiteUrl: z.url().nullable(),
  /** Reservation/booking URL — drives a dedicated "Reserve" CTA. Null when unset. */
  reservationUrl: z.url().nullable(),
  /** Food/drink menu URL. Null when unset. */
  menuUrl: z.url().nullable(),
  /** E.164 phone number, for tap-to-call. Null when unset. */
  phoneNumber: PhoneSchema.nullable(),
  /** Public contact email. Null when unset. */
  contactEmail: EmailSchema.nullable(),

  /**
   * IANA timezone the opening hours are interpreted in (e.g. "America/New_York").
   * Always present — every address is stamped with one. The client uses it to
   * compute "open now" from `openingHours`.
   */
  timezone: z.string(),
  /** Opening-hours intervals (may be empty when the business hasn't set hours). */
  openingHours: z.array(OpeningHoursPeriodSchema),
});

export type BusinessPublicDetails = z.infer<typeof BusinessPublicDetailsSchema>;
export type BusinessPublicDetailsInput = z.input<
  typeof BusinessPublicDetailsSchema
>;
