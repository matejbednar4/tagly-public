import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import {
  IgPostTypeSchema,
  CustomerShareStatusSchema,
} from "../../../../core/enums";
import { RatingStarsSchema } from "../../../../core/rating";
import { MediaPreviewSchema } from "../../crossApp/common/media";

/**
 * A customer's own share (their Instagram post for a business) as it appears in
 * a list — the lean "preview" shape, returned by `GET /v2/customers/me/shares`.
 * Reward shows the estimate until paid, then the final payout.
 */
export const CustomerSharePreviewSchema = z.object({
  uid: ShareUidSchema,
  /** Single derived customer-facing status (see CustomerShareStatusSchema):
   *  PROCESSING / UNDER_REVIEW / REPORT_REVIEW / PAID / REJECTED / UNPAYABLE. */
  status: CustomerShareStatusSchema,
  createdAt: ISODateSchema,
  /** When it went live on Instagram, or null if not posted yet. */
  postedToIgAt: ISODateSchema.nullable(),
  igPostType: IgPostTypeSchema.nullable(),
  /** Reward estimated at creation. */
  estimatedRewardCents: CentsSchema,
  /** Reach the estimate was built on (null for legacy rows). */
  estimatedAverageReach: z.number().int().nonnegative().nullable(),
  /** Actual payout once PAID, else null. */
  finalRewardCents: CentsSchema.nullable(),
  /** Quality rating as half-stars: 1–10 = ½★–5★ (divide by 2). Null = unrated.
   *  "Reported" is not a rating — it's reflected in `status` (REPORT_REVIEW). */
  ratingStars: RatingStarsSchema.nullable(),
  media: MediaPreviewSchema,
  thumbnail: MediaPreviewSchema.nullable(),
  /** The business this share was for (name only in the preview). */
  local: z.object({ name: z.string() }).nullable(),
});

/** Raw hydrator shape (accepts `bigint` cents before coercion). */
export type CustomerSharePreviewInput = z.input<
  typeof CustomerSharePreviewSchema
>;
export type CustomerSharePreview = z.infer<typeof CustomerSharePreviewSchema>;
