import { z } from "zod";

/**
 * v2 `GET /v2/public/stats` — public marketing counters for landing surfaces
 * (the join page's "Join X people already on Tagly" line, the marketing
 * site's hero social-proof chips). Unauthenticated and IP-rate-limited; both
 * consumers cache the fetch in Next's data cache (5 min) — the numbers are
 * social proof, not live telemetry.
 *
 * `customerCount` is the raw total; `businessCount` counts business pages a
 * customer could currently see in the app (ACTIVE status). Presentation
 * (display threshold, rounding, "+") is the consumer's job. Extend with
 * further counters (payouts, …) as marketing needs them — additive only.
 */
export const GetPublicStatsResponseSchema = z.object({
  message: z.string(),
  customerCount: z.number().int().nonnegative(),
  businessCount: z.number().int().nonnegative(),
});
export type GetPublicStatsResponse = z.infer<typeof GetPublicStatsResponseSchema>;
