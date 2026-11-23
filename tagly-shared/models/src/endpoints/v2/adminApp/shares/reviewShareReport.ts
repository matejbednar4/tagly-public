import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { RatingStarsSchema } from "../../../../core/rating";

/**
 * `PUT /v2/admin/shares/:uid/report-review` — resolve a PENDING share report.
 * Discriminated verdict:
 *   - VALID     — the advertiser was right: the report is upheld, any budget
 *                 lock is returned (unless already PAID), and the customer's
 *                 multiplier takes the escalating report penalty. The share is
 *                 never paid (the payment gate excludes VALID reports).
 *   - DISMISSED — the content was fine: the report is dismissed and the admin
 *                 MUST supply a quality rating (half-stars) in the advertiser's
 *                 stead; the payout then proceeds normally.
 * `reviewMessage` is an internal admin note stored on the report row.
 */
export const AdminReviewShareReportParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type AdminReviewShareReportParams = z.infer<
  typeof AdminReviewShareReportParamsSchema
>;

export const AdminReviewShareReportBodySchema = z.discriminatedUnion("verdict", [
  z.object({
    verdict: z.literal("VALID"),
    reviewMessage: z.string().max(1000).optional(),
  }),
  z.object({
    verdict: z.literal("DISMISSED"),
    reviewMessage: z.string().max(1000).optional(),
    rating: RatingStarsSchema,
  }),
]);
export type AdminReviewShareReportBody = z.infer<
  typeof AdminReviewShareReportBodySchema
>;

export const AdminReviewShareReportResponseSchema = z.object({
  message: z.string(),
});
export type AdminReviewShareReportResponse = z.infer<
  typeof AdminReviewShareReportResponseSchema
>;
