import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/advertisers/start-email` — unified email entry for the
 * clean v2 advertiser onboarding flow (login + registration in one call). Twin
 * of the customer `start-email`; same consent model:
 *   - **No consent fields.** ToS + Privacy are accepted *passively* on the
 *     sign-in screen, so the backend stamps `agreedToTermsOfServiceAt` /
 *     `agreedToPrivacyPolicyAt` on the PendingAdvertiserAccount at creation.
 *   - **Promo is not collected here.** Marketing consent is a separate,
 *     EU-gated screen after OTP (`save-marketing-consent`).
 *
 * `locale` + `language` are required — the client has already resolved them via
 * `/v2/public/suggest-locale` (or the locale picker) on the landing screen.
 */
export const StartEmailBodySchema = z.object({
  email: EmailSchema,
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
});
export type StartEmailBody = z.infer<typeof StartEmailBodySchema>;

/**
 * start-email only confirms a code is on its way — it deliberately does **not**
 * report login-vs-registration. That branch matters only once the code is
 * verified, so it's carried by `verify-otp` instead.
 */
export const StartEmailResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema,
});
export type StartEmailResponse = z.infer<typeof StartEmailResponseSchema>;
