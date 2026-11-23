import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { GeoAddressPreviewSchema } from "../../../../core/geo";
import { CentsSchema } from "../../../../core/money";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { BusinessTypePreviewSchema } from "../../crossApp/common/businessType";

/**
 * A business (local subaccount) as shown to customers on the map / in search.
 * Lean by design — no `status` / `tags` / `instagramTag` (customer-irrelevant).
 *
 * `estimatedRewardCents` / `estimatedAverageReach` / `rewardMessageSlugs` are the
 * reward projection; they're null/empty until the reward-estimate backend lands.
 */
export const BusinessPublicPreviewSchema = z.object({
  uid: LocalSubaccountUidSchema,
  name: z.string(),
  banner: MediaPreviewSchema,
  type: BusinessTypePreviewSchema,
  address: GeoAddressPreviewSchema,
  /**
   * Whether the business currently passes the canonical accessibility rule
   * (funded / subsidized-with-allowance / PAYG — `businessAccessibleSql`), i.e.
   * whether a share created now could be paid. Always true for listing-sourced
   * previews (map/search/Discover filter on accessibility), but the detail
   * read, the visited list, and a share's embedded business are deliberately
   * visibility-only, so THOSE can carry `false` — the client must gate every
   * "Earn here" CTA on it instead of dead-ending at createShare's 4003.
   */
  isAccessible: z.boolean(),
  /**
   * The estimated reward, capped server-side to what the business's budget can
   * actually fund. For a credits-only business with a thin budget this is the
   * affordable payout (60% of the collectable gross), not the raw algo estimate
   * — so it never over-promises. Subsidized / PAYG estimates are never capped.
   * Null when no estimate could be calculated (e.g. no Instagram data).
   */
  estimatedRewardCents: CentsSchema.nullable(),
  // Reach the customer's story needs to hit to earn the estimated reward.
  // Null when no estimate could be calculated (e.g. no Instagram data).
  estimatedAverageReach: z.number().int().nonnegative().nullable(),
  rewardMessageSlugs: z.array(z.string()),
  isSubsidizedByPlatform: z.boolean(),
  /**
   * The estimate was capped below the raw algo value because the budget can't
   * fund the full reward — drives "up to {amount}" phrasing in the app. Never
   * true for subsidized / PAYG businesses (their estimates are never capped).
   */
  isRewardCapped: z.boolean(),
  /**
   * Scarcity flag: the business's remaining funding capacity is low
   * (below the visibility floor + LOW_BUDGET_WARNING_MARGIN_CENTS, or the
   * estimate was already capped) so it may run out of budget and disappear
   * soon. Drives the "Ending soon" badge + scarcity notice. Never true for
   * subsidized / PAYG.
   */
  isLowBudget: z.boolean(),
});

export type BusinessPublicPreview = z.infer<typeof BusinessPublicPreviewSchema>;
