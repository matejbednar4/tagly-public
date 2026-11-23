import { z } from "zod";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/customers/google` — Google sign-in / sign-up.
 *
 * The client obtains a Google **ID token** via the native Google Sign-In SDK
 * and sends it here; the backend verifies it against Google's public keys
 * (checking `aud` + `iss`, and `nonce` when provided), then extracts the
 * verified email + stable `sub`. The `sub` is persisted as a
 * `CustomerOAuthIdentity(provider=GOOGLE)` row so repeat logins match by
 * identity, not just email.
 *
 * Because Google verifies the email, there is **no OTP leg** — a new user lands
 * directly on the promo step (EU) or profile step. ToS + Privacy are stamped
 * passively at account creation, same as the email flow.
 *
 * `locale` + `language` are resolved on the landing screen, exactly as for
 * `start-email`. `nonce` is the raw nonce the client bound to the sign-in
 * request (for replay protection); send it when the native flow supports it.
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
 *   - "login"        — existing Customer → session JWT.
 *   - "registration" — new/resuming PendingCustomer → `registrationToken`.
 *
 * `suggestedFullName` — the name Google returned, offered to *prefill* the
 * profile form. It is deliberately NOT written to the account (that would make
 * `profileComplete` true and skip the profile step); it is a UI hint only.
 *
 * The registration branch also carries the **resume state** (`locale`,
 * `marketingConsentResolved`) — same as `verify-otp` / `check-registration` — so
 * an OAuth login into a mid-onboarding pending account skips finished steps.
 */
export const GoogleSignInResponseSchema = z.discriminatedUnion("type", [
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
    suggestedFullName: z.string().nullable(),
  }),
]);
export type GoogleSignInResponse = z.infer<typeof GoogleSignInResponseSchema>;
