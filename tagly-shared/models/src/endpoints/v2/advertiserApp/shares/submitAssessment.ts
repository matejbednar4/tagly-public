import { z } from "zod";
import { ReportTypeSchema } from "../../../../core/enums";
import { RatingStarsSchema } from "../../../../core/rating";
import { AdvertiserSharePreviewSchema } from "../../../../dtos/v2/advertiserApp/shares/advertiserSharePreview";

/**
 * `POST /v2/advertisers/shares/:uid/assessment` — the advertiser assesses one of
 * their shares. Rating and reporting are the two mutually-exclusive outcomes of
 * the same action (they share the IDOR/approval guard, the customer-multiplier
 * bookkeeping, and the notification), so they are one endpoint with a
 * discriminated body.
 *
 *   - `RATING` → set the half-star quality rating (adjusts the customer's
 *     quality multiplier).
 *   - `REPORT` → flag the share for admin review (creates a PENDING ShareReport).
 *
 * A share is assessed **once** — the first rating or report is final (no re-rate,
 * re-report, or change window); a second attempt is a 409. The response echoes
 * the freshly-updated share so the client can swap it into any list in place.
 */
export const ShareAssessmentBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RATING"),
    /** Half-stars 1–10 (½★–5★). */
    rating: RatingStarsSchema,
  }),
  z.object({
    kind: z.literal("REPORT"),
    reportType: ReportTypeSchema,
    reportMessage: z
      .string()
      .max(1000, "reportMessage too long (max 1000 chars)")
      .optional(),
  }),
]);
export type ShareAssessmentBody = z.infer<typeof ShareAssessmentBodySchema>;

export const ShareAssessmentResponseSchema = z.object({
  message: z.string(),
  /** The share after the assessment, with fresh `rating` / `report` / `ratedAt`. */
  share: AdvertiserSharePreviewSchema,
});
export type ShareAssessmentResponse = z.infer<
  typeof ShareAssessmentResponseSchema
>;
