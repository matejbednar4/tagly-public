import { z } from "zod";

/**
 * `POST /v2/admin/links/:id/review` — approve or reject a PENDING link.
 * APPROVED makes the URL live on every business referencing it; REJECTED is a
 * global kill-switch (the shared Link row hides the URL everywhere, and any
 * future business entering the same URL inherits the rejection). Only PENDING
 * links are reviewable — the decision is atomic and once-only.
 */
export const AdminReviewLinkParamsSchema = z.object({
  // Links have no uid — the numeric DB id is the wire identifier (admin-only).
  id: z.coerce.number().int().positive(),
});
export type AdminReviewLinkParams = z.infer<typeof AdminReviewLinkParamsSchema>;

export const AdminReviewLinkBodySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});
export type AdminReviewLinkBody = z.infer<typeof AdminReviewLinkBodySchema>;

export const AdminReviewLinkResponseSchema = z.object({
  message: z.string(),
});
export type AdminReviewLinkResponse = z.infer<
  typeof AdminReviewLinkResponseSchema
>;
