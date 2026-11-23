import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";
import { SupportedLocaleSchema } from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/advertisers/verify-otp` — verify the emailed OTP for
 * both advertiser login and registration.
 *
 * The body carries **no consent fields**: ToS + Privacy were stamped passively
 * at `start-email`, and promo is a later EU-gated screen. So this step only
 * proves control of the email.
 */
export const VerifyOtpBodySchema = z.object({
  email: EmailSchema,
  otp: z.string(),
});
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;

/**
 * Discriminated union by `type`:
 *   - "login"        — existing Advertiser; verify succeeded → session JWT.
 *   - "registration" — PendingAdvertiserAccount; email now verified. The client
 *                      advances to the next onboarding step using
 *                      `registrationToken`.
 *
 * The registration branch carries the advertiser **resume state** so logging
 * into a mid-onboarding pending account drops the user straight at the right
 * step. Unlike the customer flow there is **no `profileComplete`** — the
 * advertiser has no pending-profile step (the account is created first, business
 * setup follows), so resume only needs:
 *   - `locale` — locale stored on the account; drives the EU/CZ-only consent step.
 *   - `marketingConsentResolved` — promo opt-in already answered (skip consent).
 */
export const VerifyOtpResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("login"),
    jwt: z.string(),
  }),
  z.object({
    type: z.literal("registration"),
    registrationToken: z.string(),
    locale: SupportedLocaleSchema,
    marketingConsentResolved: z.boolean(),
  }),
]);
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;
