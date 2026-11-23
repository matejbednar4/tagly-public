import { z } from "zod";

/**
 * A story's Instagram performance, once the insights worker has captured it.
 * The whole object is null until then; each metric is independently nullable
 * because Instagram omits some for a given story. Stories-focused (v2 shares are
 * stories) — the metrics that actually move the reward.
 *
 * Canonical, shared across apps: the customer detail (their earnings context) and
 * the advertiser detail (post-rating, once the rating gate has passed) both read
 * the same shape.
 */
export const ShareInsightsSchema = z.object({
  reach: z.number().int().nonnegative().nullable(),
  views: z.number().int().nonnegative().nullable(),
  replies: z.number().int().nonnegative().nullable(),
  profileVisits: z.number().int().nonnegative().nullable(),
  follows: z.number().int().nonnegative().nullable(),
  shares: z.number().int().nonnegative().nullable(),
  totalInteractions: z.number().int().nonnegative().nullable(),
});
export type ShareInsights = z.infer<typeof ShareInsightsSchema>;
