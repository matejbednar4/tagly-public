import { z } from "zod";
import {
  ShareUidSchema,
  CustomerUidSchema,
  AdvertiserUidSchema,
  LocalSubaccountUidSchema,
} from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema } from "../../../../core/money";
import {
  IgPostTypeSchema,
  ShareStatusSchema,
  ShareApprovalStatusSchema,
  CustomerShareStatusSchema,
  AdvertiserShareStatusSchema,
  ShareFundingModeSchema,
  CustomerStatusSchema,
} from "../../../../core/enums";
import { RatingStarsSchema } from "../../../../core/rating";
import { InstagramTagSchema } from "../../../../core/instagram";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { BusinessTypePreviewSchema } from "../../crossApp/common/businessType";
import { ShareInsightsSchema } from "../../crossApp/shares/shareInsights";
import { AdminLedgerEventSchema } from "./adminLedgerEvent";
import { AdminFinalPriceSchema } from "./adminFinalPrice";
import { AdminShareReportSchema } from "./adminShareReport";

/**
 * One share, full admin view. Shows the status from THREE angles so admin sees
 * exactly what each party sees plus the ground truth:
 *   - `customerStatus`  — derived (deriveCustomerShareStatus), what the customer sees.
 *   - `advertiserStatus`— derived (deriveAdvertiserShareStatus), what the advertiser sees.
 *   - `visibleToAdvertiser` — is the share in the advertiser's world at all
 *     (approvalStatus APPROVED). When false, `advertiserStatus` is moot (they see nothing).
 *   - raw axes (`rawStatus`, `approvalStatus`, `report.status`) — the DB ground truth.
 *
 * Also carries the full `finalPrice` audit row (every multiplier + cap/settlement
 * detail), the ledger trail, and the settlement-retry / last-error bookkeeping so
 * admin can see WHY a share is stuck without grepping logs. Rating is half-stars
 * (`ratingStars`); insights are the unified `insights` object.
 */
export const AdminShareSchema = z.object({
  uid: ShareUidSchema,

  // — Status (three views + ground truth) —
  customerStatus: CustomerShareStatusSchema,
  advertiserStatus: AdvertiserShareStatusSchema,
  visibleToAdvertiser: z.boolean(),
  rawStatus: ShareStatusSchema,
  approvalStatus: ShareApprovalStatusSchema,
  reviewedAt: ISODateSchema.nullable(),
  reviewedByAdminId: z.number().nullable(),
  rejectionReason: z.string().nullable(),
  fundingModeAtCreation: ShareFundingModeSchema,
  report: AdminShareReportSchema.nullable(),

  // — Media —
  media: MediaPreviewSchema,
  thumbnail: MediaPreviewSchema.nullable(),
  igPostId: z.string().nullable(),
  igPostType: IgPostTypeSchema.nullable(),
  postedToIgAt: ISODateSchema.nullable(),

  // — Price: estimate —
  estimatedPriceCents: CentsSchema,
  estimatedRewardCents: CentsSchema,
  estimatedAverageReach: z.number().int().nonnegative().nullable(),

  // — Price: final (ledger-derived) —
  finalPriceCents: CentsSchema.nullable(),
  finalRewardCents: CentsSchema.nullable(),
  totalPlatformDeltaCents: CentsSchema.nullable(),
  /** The stored FinalPrice audit row (all multipliers + cap/settlement detail). Null until settled. */
  finalPrice: AdminFinalPriceSchema.nullable(),

  // — Rating —
  ratingStars: RatingStarsSchema.nullable(),
  ratedAt: ISODateSchema.nullable(),
  /** Server-computed: the admin should rate this share in the advertiser's stead
   *  (approved, SUBSIDIZED, never assessed, customer still exists). Same predicate
   *  the admin unrated queue filters on. */
  shouldAssessShare: z.boolean(),

  // — Insights —
  insights: ShareInsightsSchema.nullable(),

  // — Lifecycle / debug —
  createdAt: ISODateSchema,
  paidAt: ISODateSchema.nullable(),
  lastProcessingError: z.string().nullable(),
  lastProcessingErrorAt: ISODateSchema.nullable(),
  paygChargeAttempts: z.number().nullable(),
  paygNextRetryAt: ISODateSchema.nullable(),
  stripePaymentIntentId: z.string().nullable(),
  forceCreated: z.boolean().nullable(),

  // — Money trail —
  ledgerEvents: z.array(AdminLedgerEventSchema),

  // — Relations —
  local: z
    .object({
      uid: LocalSubaccountUidSchema,
      name: z.string(),
      banner: MediaPreviewSchema,
      type: BusinessTypePreviewSchema,
      instagramTag: InstagramTagSchema.nullable(),
      city: z.string(),
    })
    .nullable(),
  customer: z
    .object({
      uid: CustomerUidSchema,
      fullName: z.string(),
      instagramUsername: z.string().nullable(),
      instagramPfpUrl: z.string().nullable(),
      multiplierBps: z.number(),
      status: CustomerStatusSchema,
    })
    .nullable(),
  /** The funding advertiser (null for a subsidized / unowned share). */
  advertiserUid: AdvertiserUidSchema.nullable(),
});
export type AdminShare = z.infer<typeof AdminShareSchema>;
export type AdminShareInput = z.input<typeof AdminShareSchema>;
