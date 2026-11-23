import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { ShareVoidReasonSchema } from "../../../../core/enums";
import {
  ShareInsightsSchema,
  type ShareInsights,
} from "../../../../core/shareInsights";
import { AdvertiserSharePreviewSchema } from "./advertiserSharePreview";

export type { ShareInsights };

/**
 * One of the advertiser's shares, full detail view — the `AdvertiserSharePreview`
 * plus the extra fields the detail screen shows. Fetched by uid
 * (`GET /v2/advertisers/shares/:uid`).
 *
 * The detail DOES surface the story's Instagram `insights` (reach / views / …) —
 * a deliberate exception to the "advertiser rates post quality, not performance"
 * rule that governs the previews + the rate sheet. It's safe here because the
 * detail screen is **rating-gated**: an unassessed share can't be viewed until
 * it's rated (or reported), so the performance figures can never bias the rating
 * — by the time they're visible, the rating is already final. `paidAt` is added
 * for the spend card's "paid on" line. Both are nullable and degrade gracefully;
 * the hydrator never throws.
 */
export const AdvertiserShareDetailsSchema = AdvertiserSharePreviewSchema.extend({
  /** Why the share was voided, when `status` is UNPAYABLE — a slug the screen
   *  maps to localized copy ("the customer disconnected Instagram", "stats
   *  couldn't be collected before the story expired", …). Nothing is charged
   *  either way. Null on non-UNPAYABLE shares and on pre-column voids. */
  voidReason: ShareVoidReasonSchema.nullable(),
  /** When the share settled (the advertiser was charged). Null until PAID. */
  paidAt: ISODateSchema.nullable(),
  /** The story's Instagram performance. Null until the insights worker captures it. */
  insights: ShareInsightsSchema.nullable(),
});

export type AdvertiserShareDetails = z.infer<
  typeof AdvertiserShareDetailsSchema
>;
export type AdvertiserShareDetailsInput = z.input<
  typeof AdvertiserShareDetailsSchema
>;
