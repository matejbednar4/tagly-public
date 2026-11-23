import { z } from "zod";

/**
 * `POST /v2/cross/support` — contact support / request help (e.g. appeal a ban).
 * Cross-app + authed (any valid JWT): both the customer and advertiser apps post
 * here. The backend emails the request to the support inbox (no persistence); the
 * team replies to the user by email. Twin of `/v2/cross/feedback`, routed to the
 * support inbox with an optional origin tag for triage.
 */
export const SubmitSupportBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /**
   * Optional machine-readable origin tag for where the request was opened from
   * (e.g. `"banned-account"`), surfaced in the team email so support can triage
   * without the user having to explain context. Not shown to the user.
   */
  context: z.string().trim().max(100).optional(),
});
export type SubmitSupportBody = z.infer<typeof SubmitSupportBodySchema>;

export const SubmitSupportResponseSchema = z.object({
  message: z.string(),
});
export type SubmitSupportResponse = z.infer<typeof SubmitSupportResponseSchema>;
