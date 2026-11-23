import { z } from "zod";
import { CentsSchema } from "../../../../core/money";

/**
 * Lifetime sharing statistics, returned by `GET /v2/customers/me/statistics`.
 * Pure sharing activity — referral earnings live on `CustomerReferrals`.
 */
export const CustomerStatisticsSchema = z.object({
  totalShares: z.number().int().nonnegative(),
  /** Σ of SHARE_PAYMENT payouts credited to the customer. */
  totalRewardsCents: CentsSchema,
  /** totalRewardsCents ÷ paid-share count (0 if none paid yet). */
  averageRewardPerShareCents: CentsSchema,
  /** Distinct businesses the customer has shared. */
  visitedPlaces: z.number().int().nonnegative(),
  /** Σ Instagram reach across the customer's posted shares (post/story/reel). */
  totalReachCount: z.number().int().nonnegative(),
});

/** Raw hydrator shape (accepts `bigint`/`string` cents before coercion). */
export type CustomerStatisticsInput = z.input<typeof CustomerStatisticsSchema>;
export type CustomerStatistics = z.infer<typeof CustomerStatisticsSchema>;
