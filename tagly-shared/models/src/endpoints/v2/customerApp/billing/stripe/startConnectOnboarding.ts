import { z } from "zod";
import { ISODateSchema } from "../../../../../core/time";

// The hosted Stripe Connect onboarding link the client opens to complete KYC.
// `expiresAt` is Stripe's short-lived account-link expiry (re-request when past).
export const StartConnectOnboardingResponseSchema = z.object({
  stripeAccountId: z.string(),
  url: z.url(),
  expiresAt: ISODateSchema,
});
export type StartConnectOnboardingResponse = z.infer<
  typeof StartConnectOnboardingResponseSchema
>;
