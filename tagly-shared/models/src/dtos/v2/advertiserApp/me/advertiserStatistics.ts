import { z } from "zod";
import { CentsSchema } from "../../../../core/money";

/**
 * Lifetime advertiser statistics, returned by
 * `GET /v2/advertisers/me/statistics`. Aggregated over the advertiser's
 * APPROVED shares only (PENDING/REJECTED shares are invisible to the
 * advertiser everywhere). Split off `/me` so it can be fetched + cached on its
 * own cadence, mirroring the customer's `me/statistics`.
 */
export const AdvertiserStatisticsSchema = z.object({
  /** Count of the advertiser's APPROVED shares (all payout states). */
  totalShares: z.number().int().nonnegative(),
  /** Σ final price of the advertiser's shares (what they've spent). */
  totalSpendCents: CentsSchema,
  /** totalSpendCents ÷ PAID-share count (0 if none paid yet). */
  averagePricePerShareCents: CentsSchema,
  /** Σ Instagram reach across the advertiser's posted shares. */
  totalReach: z.number().int().nonnegative(),
  /** Σ referral payouts credited to the advertiser (optional; omitted if 0). */
  totalReferralPayoutsCents: CentsSchema.optional(),
});

/** Raw hydrator shape (accepts `bigint` cents before coercion). */
export type AdvertiserStatisticsInput = z.input<
  typeof AdvertiserStatisticsSchema
>;
export type AdvertiserStatistics = z.infer<typeof AdvertiserStatisticsSchema>;
