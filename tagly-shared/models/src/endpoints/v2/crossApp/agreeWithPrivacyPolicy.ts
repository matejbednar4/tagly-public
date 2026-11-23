import { z } from "zod";

/**
 * `POST /v2/cross/privacy-policy/agree` — twin of the ToS endpoint for the
 * Privacy Policy. Cross-app + authed (either app's JWT). No request body; the
 * server stamps `agreedToPrivacyPolicyAt = now`, clearing the
 * `shouldAgreeWithLatestPrivacyPolicy` gate on `GET /me`.
 */
export const AgreeWithPrivacyPolicyResponseSchema = z.object({
  agreedWithLatestPrivacyPolicy: z.literal(true),
});
export type AgreeWithPrivacyPolicyResponse = z.infer<
  typeof AgreeWithPrivacyPolicyResponseSchema
>;
