import { z } from "zod";
import { AdvertiserSharePreviewSchema } from "../../../../dtos/v2/advertiserApp/shares/advertiserSharePreview";

/**
 * `GET /v2/advertisers/shares/unrated` — the advertiser's oldest still-unrated
 * shares (the "shares to rate" home strip). Authed; pure read. Not paginated:
 * returns a small fixed page (oldest first, so the longest-waiting shares are
 * rated first) plus the full outstanding count for a badge.
 *
 * "Unrated" = APPROVED, has a customer, and never rated or reported
 * (`ratedAt` null). Reporting stamps `ratedAt`, so a reported share drops out.
 */
export const GetUnratedSharesResponseSchema = z.object({
  message: z.string(),
  shares: z.array(AdvertiserSharePreviewSchema),
  /** Total outstanding unrated shares (may exceed `shares.length`). */
  totalUnratedCount: z.number().int().nonnegative(),
});
export type GetUnratedSharesResponse = z.infer<
  typeof GetUnratedSharesResponseSchema
>;
