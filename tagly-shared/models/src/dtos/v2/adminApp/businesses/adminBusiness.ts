import { z } from "zod";
import {
  LocalSubaccountUidSchema,
  AdvertiserUidSchema,
} from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema } from "../../../../core/money";
import { SubaccountStatusSchema } from "../../../../core/enums";
import { SupportedLocaleSchema } from "../../../../core/locale";
import { GeoAddressSchema, LocationSchema } from "../../../../core/geo";
import { InstagramTagSchema } from "../../../../core/instagram";
import { LinkStatusSchema } from "../../../../core/link";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { OpeningHoursPeriodSchema } from "../../crossApp/common/openingHoursPeriod";
import { BusinessTypePreviewSchema } from "../../crossApp/common/businessType";
import { BusinessAccessibilitySchema } from "./businessAccessibility";

/**
 * Search aliases an admin may set on a business ("tags") — extra strings
 * the customer search matches besides the name. Admin wire only: advertisers
 * can never set tags (the advertiser create/update schemas have no such
 * field). Normalized at the wire — trimmed + lowercased; max 5.
 */
export const AdminBusinessTagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(5);
export type AdminBusinessTags = z.infer<typeof AdminBusinessTagsSchema>;

/**
 * A business web link (website / reservation / menu) in the admin view. Unlike
 * the customer shape (which only ever exposes APPROVED urls), admins see the
 * `status` too so PENDING / REJECTED links are visible for moderation.
 */
export const AdminBusinessLinkSchema = z.object({
  url: z.string(),
  status: LinkStatusSchema,
});
export type AdminBusinessLink = z.infer<typeof AdminBusinessLinkSchema>;

export const AdminBusinessStatisticsSchema = z.object({
  totalShares: z.number(),
  totalSpendCents: z.number(),
  averagePricePerShareCents: z.number(),
  uniqueCustomers: z.number(),
  totalReach: z.number(),
});
export type AdminBusinessStatistics = z.infer<
  typeof AdminBusinessStatisticsSchema
>;

/**
 * One business (local subaccount), full admin view. The headline is
 * `accessibility` — whether customers can currently see it and exactly why / why
 * not (the `businessAccessibleSql` rule exposed as data): one
 * `accessibility.isAccessible` (visible == shareable), and `type` is the
 * slug-only `BusinessTypePreview`.
 */
export const AdminBusinessSchema = z.object({
  uid: LocalSubaccountUidSchema,
  name: z.string(),
  description: z.string().nullable(),
  banner: MediaPreviewSchema,
  photos: z.array(MediaPreviewSchema),
  type: BusinessTypePreviewSchema,
  // + countryCode over the shared GeoAddress: the admin edit screens derive
  // the page's market (US/CZ region list, country lock) from it.
  address: GeoAddressSchema.extend({ countryCode: z.string() }),
  cityLocation: LocationSchema.nullable(),
  status: SubaccountStatusSchema,
  tags: z.array(z.string()),
  instagramTag: InstagramTagSchema.nullable(),

  // Contact + web links. Links carry their moderation `status` so admins see
  // PENDING / REJECTED ones too (customers are only ever shown APPROVED urls).
  contactEmail: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  websiteLink: AdminBusinessLinkSchema.nullable(),
  reservationLink: AdminBusinessLinkSchema.nullable(),
  menuLink: AdminBusinessLinkSchema.nullable(),

  // Opening hours + the IANA timezone they're interpreted in (the client
  // computes "open now" from these, exactly as the customer app does).
  timezone: z.string(),
  openingHours: z.array(OpeningHoursPeriodSchema),

  accessibility: BusinessAccessibilitySchema,

  advertiser: z
    .object({
      uid: AdvertiserUidSchema,
      email: z.string(),
      locale: SupportedLocaleSchema,
      availableBudgetUsdCents: CentsSchema,
      lockedBudgetUsdCents: CentsSchema,
      /**
       * Lifetime GROSS credits purchased, derived from the ledger (sum of
       * CREDIT_PURCHASE events only — PAYG charges, refunds, dispute clawbacks
       * and deletion forfeits are excluded), so it is not a net figure. Admin
       * display only; nothing gates on it.
       */
      totalCreditPurchasesUsdCents: CentsSchema,
    })
    .nullable(),
  isSubsidized: z.boolean(),
  subsidizationPeriods: z.array(
    z.object({
      startedAt: ISODateSchema,
      endedAt: ISODateSchema.nullable(),
    }),
  ),
  subsidizedShareCount: z.number(),

  statistics: AdminBusinessStatisticsSchema,

  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});
export type AdminBusiness = z.infer<typeof AdminBusinessSchema>;
export type AdminBusinessInput = z.input<typeof AdminBusinessSchema>;
