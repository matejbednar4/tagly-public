import { z } from "zod";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/customers/apple` — Apple sign-in / sign-up.
 *
 * The client obtains an Apple **identity token** (a JWT) via
 * `expo-apple-authentication` and sends it here; the backend verifies it
 * against Apple's public keys (checking `iss` = Apple, `aud` = our bundle/
 * service id, and `nonce` when provided), then extracts the verified email +
 * stable `sub`. The `sub` is persisted as a
 * `CustomerOAuthIdentity(provider=APPLE)` row.
 *
 * **Apple only returns the user's email + name on the FIRST authorization** —
 * every later sign-in returns just the `sub`. That is exactly why we store the
 * `sub` and match on it: repeat logins have no email to match. On that first
 * authorization the client also passes the assembled `fullName` (Apple gives
 * given + family name once) so we can suggest it as a profile prefill.
 *
 * Like Google, there is **no OTP leg**; ToS + Privacy are stamped passively at
 * account creation.
 */
export const AppleSignInBodySchema = z.object({
  identityToken: z.string().min(1),
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
  nonce: z.string().min(1).optional(),
  /** Present only on Apple's first authorization for this user. */
  fullName: z.string().min(1).optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBodySchema>;

/**
 * Discriminated union by `type` — identical shape to `GoogleSignInResponse`
 * (see there for field semantics): "login" → JWT, "registration" →
 * `registrationToken` + `profileComplete` + resume state (`locale`,
 * `marketingConsentResolved`) + `suggestedFullName`.
 */
export const AppleSignInResponseSchema = z.discriminatedUnion("type", [
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
export type AppleSignInResponse = z.infer<typeof AppleSignInResponseSchema>;
