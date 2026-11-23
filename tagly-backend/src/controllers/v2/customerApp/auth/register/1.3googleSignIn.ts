import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import { OAUTH } from "../../../../../constants/auth/OAUTH.js";
import { verifyOidcIdToken } from "../../../../../utils/auth/verifyOidcIdToken.js";
import { handleOAuthSignIn } from "../../../../../utils/auth/handleOAuthSignIn.js";
import { getCustomerResumeStateByToken } from "../../../../../utils/auth/getCustomerResumeStateByToken.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import { validateLocaleIsSupportedOrThrow } from "../../../../../utils/localization/validateLocaleIsSupportedOrThrow.js";
import { validateLanguageIsSupportedOrThrow } from "../../../../../utils/localization/validateLanguageIsSupportedOrThrow.js";
import type {
  GoogleSignInBody,
  GoogleSignInResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/google` — Google sign-in / sign-up. Verifies
 * the native Google ID token against Google's JWKS, then resolves it to a login
 * or a registration via the shared `handleOAuthSignIn`. No OTP leg.
 */
export const googleSignIn: RequestHandler = asyncHandler(async (req, res) => {
  const {
    locale: rawLocale,
    language: rawLanguage,
    idToken,
    nonce,
  } = req.validatedBody as GoogleSignInBody;

  const locale = validateLocaleIsSupportedOrThrow(rawLocale);
  const language = validateLanguageIsSupportedOrThrow(rawLanguage);

  const audience = envVariables.GOOGLE_OAUTH_CLIENT_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (audience.length === 0) {
    throw createCustomError(2236, "Google sign-in is not configured", 500);
  }

  const verified = await verifyOidcIdToken({
    token: idToken,
    jwksUri: OAUTH.GOOGLE.JWKS_URI,
    issuer: [...OAUTH.GOOGLE.ISSUERS],
    audience,
  });

  // Google echoes the raw nonce in the claim.
  if (nonce && verified.nonce !== nonce) {
    throw createCustomError(2237, "Sign-in nonce mismatch", 401);
  }

  const result = await handleOAuthSignIn({
    kind: "CUSTOMER",
    provider: "GOOGLE",
    subject: verified.sub,
    email: verified.email,
    emailVerified: verified.emailVerified,
    locale,
    language,
  });

  if (result.type === "login") {
    res.status(200).json({
      type: "login",
      jwt: issueSessionJwt(result.account),
    } satisfies GoogleSignInResponse);
    return;
  }

  // Resume state (locale + marketing consent) so an OAuth login into a
  // mid-onboarding pending account skips already-finished steps — same shape as
  // verify-otp. `handleOAuthSignIn` is account-agnostic, so this is loaded here.
  const resume = await getCustomerResumeStateByToken(result.registrationToken);
  res.status(200).json({
    type: "registration",
    registrationToken: result.registrationToken,
    suggestedFullName: verified.name,
    ...resume,
  } satisfies GoogleSignInResponse);
});
