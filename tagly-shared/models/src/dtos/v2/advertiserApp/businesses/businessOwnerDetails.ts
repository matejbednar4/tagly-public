import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { GeoAddressSchema } from "../../../../core/geo";
import { EmailSchema } from "../../../../core/email";
import { PhoneSchema } from "../../../../core/phone";
import { InstagramTagSchema } from "../../../../core/instagram";
import { LinkStatusSchema } from "../../../../core/link";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { BusinessTypePreviewSchema } from "../../crossApp/common/businessType";
import {
  BusinessDescriptionSchema,
  BUSINESS_MAX_PHOTOS,
} from "../../crossApp/common/businessProfile";
import { OpeningHoursPeriodSchema } from "../../crossApp/common/openingHoursPeriod";

/**
 * One of the owner's web links (website / menu / reservation), carrying its
 * moderation `status` so the owner can see what's still under review or was
 * rejected. The customer detail only ever gets APPROVED links (as flat urls);
 * the owner gets the full picture.
 */
export const BusinessOwnerLinkSchema = z.object({
  url: z.url(),
  status: LinkStatusSchema,
});
export type BusinessOwnerLink = z.infer<typeof BusinessOwnerLinkSchema>;

/**
 * `BusinessOwnerDetails` — one of the advertiser's own business pages in full,
 * as shown on the owner-facing detail screen (`GET /v2/advertisers/me/
 * businesses/:uid`). It's the owner twin of the customer's
 * `BusinessPublicDetails`: the same identity + media + address + contact/links +
 * hours the public page renders, but with **none of the customer-only reward
 * projection** (`estimatedRewardCents` / `estimatedAverageReach` /
 * `rewardMessageSlugs` / `isRewardCapped` / `isLowBudget` / `isSubsidizedByPlatform`)
 * — the owner is viewing the data they entered, not a reward estimate.
 *
 * Links are surfaced **as the owner entered them** (raw url, any moderation
 * status) — this is their own page, so they see exactly what they input, unlike
 * the customer view which only shows admin-APPROVED links.
 */
export const BusinessOwnerDetailsSchema = z.object({
  uid: LocalSubaccountUidSchema,
  name: z.string(),
  /**
   * ACTIVE or BANNED — a BANNED (admin-suspended) page stays visible to its
   * owner but is hidden from customers and read-only (edit/delete refuse), so
   * the client renders a suspended notice instead of edit affordances. DELETED
   * pages are never returned to anyone.
   */
  status: z.enum(["ACTIVE", "BANNED"]),
  banner: MediaPreviewSchema,
  /** Type by slug — localized name resolved client-side from the catalog. */
  type: BusinessTypePreviewSchema,
  /** Full address (with location) — powers the address block + the map preview. */
  address: GeoAddressSchema,
  /** Gallery photos (beyond the banner). */
  photos: z.array(MediaPreviewSchema).max(BUSINESS_MAX_PHOTOS),

  /** Instagram handle (normalized, no leading "@"). Null when none is linked. */
  instagramTag: InstagramTagSchema,

  /**
   * The full set of tags a customer's story must show at least one of to
   * validate a share: the business name, its keyword tags, and its `@handle`.
   * Built server-side by `getLocalShareTags` (always includes the name).
   */
  tags: z.array(z.string()),

  /** Short "about the business" blurb. Null when the owner hasn't set one. */
  description: BusinessDescriptionSchema.nullable(),
  /** Marketing/website link (url + moderation status). Null when unset. */
  websiteLink: BusinessOwnerLinkSchema.nullable(),
  /** Reservation/booking link (url + moderation status). Null when unset. */
  reservationLink: BusinessOwnerLinkSchema.nullable(),
  /** Food/drink menu link (url + moderation status). Null when unset. */
  menuLink: BusinessOwnerLinkSchema.nullable(),
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
  /** Opening-hours intervals (may be empty when no hours are set). */
  openingHours: z.array(OpeningHoursPeriodSchema),
});

export type BusinessOwnerDetails = z.infer<typeof BusinessOwnerDetailsSchema>;
export type BusinessOwnerDetailsInput = z.input<
  typeof BusinessOwnerDetailsSchema
>;
