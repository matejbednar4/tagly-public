import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";
import { SupportedLocaleSchema } from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/customers/verify-otp` — verify the emailed OTP for both
 * login and registration.
 *
 * The body carries **no consent fields**: ToS +
 * Privacy were stamped passively at `start-email`, and promo is a later
 * EU-gated screen. So this step only proves control of the email.
 */
export const VerifyOtpBodySchema = z.object({
  email: EmailSchema,
  otp: z.string(),
});
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;

/**
 * Discriminated union by `type`:
 *   - "login"        — existing Customer; verify succeeded → session JWT.
 *   - "registration" — PendingCustomer; email now verified. The client advances
 *                      to the next onboarding step using `registrationToken`.
 *
 * The registration branch carries the full **resume state** (the same fields as
 * `check-registration`), so logging into a mid-onboarding pending account drops
 * the user straight at the right step instead of re-asking completed ones:
 *   - `profileComplete` — profile step already done (skip to Instagram).
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
    profileComplete: z.boolean(),
    locale: SupportedLocaleSchema,
    marketingConsentResolved: z.boolean(),
  }),
]);
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;
