import { z } from "zod";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../../core/locale";

/**
 * `POST /v2/public/auth/advertisers/apple` — Apple sign-in / sign-up.
 *
 * The client obtains an Apple **identity token** (a JWT) via
 * `expo-apple-authentication` and sends it here; the backend verifies it
 * against Apple's public keys (checking `iss` = Apple, `aud` = our bundle/
 * service id, and `nonce` when provided), then extracts the verified email +
 * stable `sub`, persisted as an `OAuthIdentity(provider=APPLE, kind=ADVERTISER)`
 * row. **Apple only returns the email on the FIRST authorization**, which is why
 * we store + match on the `sub`.
 *
 * There is no `fullName` field (unlike the customer flow): the advertiser has no
 * full-name profile field, so Apple's first-authorization name is not collected.
 * Like Google there is **no OTP leg**; ToS + Privacy are stamped passively at
 * account creation.
 */
export const AppleSignInBodySchema = z.object({
  identityToken: z.string().min(1),
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
  nonce: z.string().min(1).optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBodySchema>;

/**
 * Discriminated union by `type` — identical shape to `GoogleSignInResponse`
 * (see there for field semantics): "login" → JWT, "registration" →
 * `registrationToken` + advertiser resume state (`locale`,
 * `marketingConsentResolved`).
 */
export const AppleSignInResponseSchema = z.discriminatedUnion("type", [
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
export type AppleSignInResponse = z.infer<typeof AppleSignInResponseSchema>;
