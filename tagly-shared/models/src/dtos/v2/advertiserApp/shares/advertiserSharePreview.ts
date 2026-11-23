import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import {
  IgPostTypeSchema,
  AdvertiserShareStatusSchema,
} from "../../../../core/enums";
import { RatingStarsSchema } from "../../../../core/rating";
import { MediaPreviewSchema } from "../../crossApp/common/media";
import { ShareReportOwnerSchema } from "./shareReportOwner";

/**
 * One of the advertiser's shares (a customer's Instagram post promoting one of
 * their businesses) as it appears in a list, the home strips, and the
 * assessment sheet.
 *
 * Assessment fields: a share starts unassessed (`rating`, `report`, `ratedAt`
 * all null) and the advertiser assesses it exactly once — EITHER rates
 * (`rating` set) OR reports (`report` set); there is no re-rate / re-report.
 * One admin path adds the second field later: when an admin DISMISSES the
 * advertiser's report they must rate the share in the advertiser's stead
 * (`reviewShareReport`), so a dismissed share carries BOTH the (DISMISSED)
 * `report` and the admin's `rating` — clients treat the rating as the truth
 * there (the report was found baseless). A VALID report never gains a rating.
 * `ratedAt` is the (immutable) first-assessed-at stamp, set by both a rating
 * and a report; null ⟺ unassessed.
 *
 * There is deliberately NO per-share insight/reach here: the advertiser rates
 * POST QUALITY as a signal of the sharer's future quality, not the post's
 * performance — see `docs/SHARE_LIFECYCLE.md` (Share rating). `finalPriceCents`
 * / `estimatedPriceCents` are carried only for spend transparency in lists and
 * never shown in the rate sheet.
 */
export const AdvertiserSharePreviewSchema = z.object({
  uid: ShareUidSchema,
  /** Derived advertiser-facing status (`deriveAdvertiserShareStatus`): PROCESSING /
   *  REPORT_REVIEW / PAID / REJECTED / UNPAYABLE. The advertiser sees APPROVED
   *  shares only, so there is no UNDER_REVIEW. */
  status: AdvertiserShareStatusSchema,
  createdAt: ISODateSchema,
  /** When it went live on Instagram, or null if not posted yet. */
  postedToIgAt: ISODateSchema.nullable(),
  igPostType: IgPostTypeSchema.nullable(),
  /** Price locked/estimated at creation (spend transparency, not for rating). */
  estimatedPriceCents: CentsSchema,
  /** Actual price once PAID, else null (spend transparency, not for rating). */
  finalPriceCents: CentsSchema.nullable(),
  /** Quality rating as half-stars 1–10 (½★–5★). Null = unrated or reported
   *  (except a DISMISSED report, which gains the admin's stand-in rating). */
  rating: RatingStarsSchema.nullable(),
  /** When the share was assessed (rated or reported), immutable. Null = neither. */
  ratedAt: ISODateSchema.nullable(),
  /** Server-computed: the advertiser should assess this share now (approved,
   *  never assessed, and the customer still exists). The single source of truth
   *  the unrated list and the detail screen share — do NOT re-derive from
   *  `ratedAt` on the client (that misses the deleted-customer case). */
  shouldAssessShare: z.boolean(),
  /** Present when the advertiser reported the share. Coexists with `rating` only
   *  after an admin dismissed the report and rated in the advertiser's stead. */
  report: ShareReportOwnerSchema.nullable(),
  /** Platform-funded share (advertiser paid nothing) — display only. */
  isSubsidized: z.boolean(),
  media: MediaPreviewSchema,
  thumbnail: MediaPreviewSchema.nullable(),
  /** The business this share promotes (name only in the preview). */
  local: z.object({ name: z.string() }).nullable(),
});

/** Raw hydrator shape (accepts `bigint` cents before coercion). */
export type AdvertiserSharePreviewInput = z.input<
  typeof AdvertiserSharePreviewSchema
>;
export type AdvertiserSharePreview = z.infer<
  typeof AdvertiserSharePreviewSchema
>;
