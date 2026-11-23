import { z } from "zod";

/**
 * `POST /v2/cross/terms-of-service/agree` — record agreement to the latest
 * Terms of Service. Cross-app + authed (either app's JWT). No request body: the
 * acting user comes from the JWT and the server stamps
 * `agreedToTermsOfServiceAt = now`, which clears the `shouldAgreeWithLatestTos`
 * gate on `GET /me`. Twin of `agreeWithPrivacyPolicy`.
 */
export const AgreeWithTosResponseSchema = z.object({
  agreedWithLatestTos: z.literal(true),
});
export type AgreeWithTosResponse = z.infer<typeof AgreeWithTosResponseSchema>;
