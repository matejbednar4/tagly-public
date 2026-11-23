import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { RatingStarsSchema } from "../../../../core/rating";
import { ReportTypeSchema } from "../../../../core/enums";

/**
 * `POST /v2/admin/shares/:uid/assess` — the admin twin of the advertiser's
 * share assessment (`submitShareAssessment`), for SUBSIDIZED shares only
 * (subsidized businesses have no advertiser to rate/report their shares).
 * Same once-only semantics: the first RATING or REPORT is final (`ratedAt`
 * claims it atomically); a REPORT files a PENDING ShareReport that lands in
 * the report-review queue.
 */
export const AdminAssessShareParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type AdminAssessShareParams = z.infer<typeof AdminAssessShareParamsSchema>;

export const AdminAssessShareBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RATING"),
    rating: RatingStarsSchema,
  }),
  z.object({
    kind: z.literal("REPORT"),
    reportType: ReportTypeSchema,
    reportMessage: z.string().max(500).optional(),
  }),
]);
export type AdminAssessShareBody = z.infer<typeof AdminAssessShareBodySchema>;

export const AdminAssessShareResponseSchema = z.object({
  message: z.string(),
});
export type AdminAssessShareResponse = z.infer<
  typeof AdminAssessShareResponseSchema
>;
