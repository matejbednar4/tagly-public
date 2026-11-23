import { z } from "zod";

/**
 * `POST /v2/cross/feedback` — submit in-app feedback / a feature request.
 * Cross-app + authed (any valid JWT): both the customer and advertiser apps
 * post here. The backend emails the submission to the team (no persistence).
 */
export const SubmitFeedbackBodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
});
export type SubmitFeedbackBody = z.infer<typeof SubmitFeedbackBodySchema>;

export const SubmitFeedbackResponseSchema = z.object({
  message: z.string(),
});
export type SubmitFeedbackResponse = z.infer<
  typeof SubmitFeedbackResponseSchema
>;
