import type { RequestHandler } from "express";
import crypto from "node:crypto";
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
  AppleSignInBody,
  AppleSignInResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/apple` — Apple sign-in / sign-up. Verifies the
 * native Apple identity token against Apple's JWKS, then resolves it to a login
 * or registration via the shared `handleOAuthSignIn`. No OTP leg.
 *
 * `fullName` is sent only on Apple's first authorization (Apple drops it after),
 * so it's used purely as a profile prefill suggestion.
 */
export const appleSignIn: RequestHandler = asyncHandler(async (req, res) => {
  const {
    identityToken,
    locale: rawLocale,
    language: rawLanguage,
    nonce,
    fullName,
  } = req.validatedBody as AppleSignInBody;

  const locale = validateLocaleIsSupportedOrThrow(rawLocale);
  const language = validateLanguageIsSupportedOrThrow(rawLanguage);

  const audience = (envVariables.APPLE_OAUTH_CLIENT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (audience.length === 0) {
    throw createCustomError(2238, "Apple sign-in is not configured", 500);
  }

  const verified = await verifyOidcIdToken({
    token: identityToken,
    jwksUri: OAUTH.APPLE.JWKS_URI,
    issuer: [...OAUTH.APPLE.ISSUERS],
    audience,
  });

  // Apple puts the SHA-256 (hex) of the raw nonce in the claim.
  if (nonce) {
    const hashed = crypto.createHash("sha256").update(nonce).digest("hex");
    if (verified.nonce !== hashed) {
      throw createCustomError(2237, "Sign-in nonce mismatch", 401);
    }
  }

  const result = await handleOAuthSignIn({
    kind: "CUSTOMER",
    provider: "APPLE",
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
    } satisfies AppleSignInResponse);
    return;
  }

  // Resume state (locale + marketing consent) so an OAuth login into a
  // mid-onboarding pending account skips already-finished steps — same shape as
  // verify-otp. `handleOAuthSignIn` is account-agnostic, so this is loaded here.
  const resume = await getCustomerResumeStateByToken(result.registrationToken);
  res.status(200).json({
    type: "registration",
    registrationToken: result.registrationToken,
    suggestedFullName: fullName ?? verified.name,
    ...resume,
  } satisfies AppleSignInResponse);
});
