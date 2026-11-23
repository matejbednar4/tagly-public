import { z } from "zod";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/advertisers/google` — Google sign-in / sign-up.
 *
 * The client obtains a Google **ID token** via the native Google Sign-In SDK
 * and sends it here; the backend verifies it against Google's public keys
 * (checking `aud` + `iss`, and `nonce` when provided), then extracts the
 * verified email + stable `sub`. The `sub` is persisted as an
 * `OAuthIdentity(provider=GOOGLE, kind=ADVERTISER)` row so repeat logins match
 * by identity, not just email — independent of any customer identity for the
 * same Google account.
 *
 * Because Google verifies the email, there is **no OTP leg** — a new user lands
 * directly on the promo step (EU) or business setup. ToS + Privacy are stamped
 * passively at account creation, same as the email flow.
 */
export const GoogleSignInBodySchema = z.object({
  idToken: z.string().min(1),
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
  nonce: z.string().min(1).optional(),
});
export type GoogleSignInBody = z.infer<typeof GoogleSignInBodySchema>;

/**
 * Discriminated union by `type` — mirrors `verify-otp` so the client keeps one
 * discriminator across email + OAuth paths:
 *   - "login"        — existing Advertiser → session JWT.
 *   - "registration" — new/resuming PendingAdvertiserAccount → `registrationToken`
 *                      + advertiser resume state (`locale`,
 *                      `marketingConsentResolved`).
 *
 * There is no `suggestedFullName` (unlike the customer flow): the advertiser has
 * no full-name profile field, so a Google-returned name has nowhere to prefill.
 */
export const GoogleSignInResponseSchema = z.discriminatedUnion("type", [
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
export type GoogleSignInResponse = z.infer<typeof GoogleSignInResponseSchema>;
