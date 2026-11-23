import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  StartEmailBodySchema,
  ResendOtpBodySchema,
  VerifyOtpBodySchema,
  GoogleSignInBodySchema,
  AppleSignInBodySchema,
  RegisterPendingPushTokenBodySchema,
  SaveMarketingConsentBodySchema,
  AttachReferrerBodySchema,
  FinishRegistrationBodySchema,
  CheckRegistrationQuerySchema,
} from "@tagly/models/v2/advertiserApp";
import { startEmail } from "../../../../../controllers/v2/advertiserApp/auth/register/1.0startEmail.js";
import { resendOtp } from "../../../../../controllers/v2/advertiserApp/auth/register/1.1resendOtp.js";
import { verifyOtp } from "../../../../../controllers/v2/advertiserApp/auth/register/1.2verifyOtp.js";
import { googleSignIn } from "../../../../../controllers/v2/advertiserApp/auth/register/1.3googleSignIn.js";
import { appleSignIn } from "../../../../../controllers/v2/advertiserApp/auth/register/1.4appleSignIn.js";
import { saveMarketingConsent } from "../../../../../controllers/v2/advertiserApp/auth/register/2.0saveMarketingConsent.js";
import { registerPendingPushToken } from "../../../../../controllers/v2/advertiserApp/auth/register/2.1registerPendingPushToken.js";
import { attachReferrer } from "../../../../../controllers/v2/advertiserApp/auth/register/2.2attachReferrer.js";
import { finishRegistration } from "../../../../../controllers/v2/advertiserApp/auth/register/3.finishRegistration.js";
import { checkRegistration } from "../../../../../controllers/v2/advertiserApp/auth/checkRegistration.js";

/**
 * `/v2/public/auth/advertisers` — advertiser onboarding/login (OTP + Google/
 * Apple). Public; the parent `/auth` mount applies `authIpLimiter`, so every
 * route here inherits the stricter auth IP rate limit. Leaf routes in
 * onboarding-step order (controllers are numbered to match).
 *
 * Mirrors the customer flow except: no profile step on the pending account (the
 * advertiser account is created first via `finish-registration`, business setup
 * follows on the authenticated account) and no Instagram login.
 */
const r = Router();

// 1 — entry (create pending account / login)
r.post("/start-email", validateReq("body", StartEmailBodySchema), startEmail);
r.post("/resend-otp", validateReq("body", ResendOtpBodySchema), resendOtp);
r.post("/verify-otp", validateReq("body", VerifyOtpBodySchema), verifyOtp);
r.post("/google", validateReq("body", GoogleSignInBodySchema), googleSignIn);
r.post("/apple", validateReq("body", AppleSignInBodySchema), appleSignIn);

// 2 — onboarding steps
r.post(
  "/save-marketing-consent",
  validateReq("body", SaveMarketingConsentBodySchema),
  saveMarketingConsent,
);
r.post(
  "/pending-push-token",
  validateReq("body", RegisterPendingPushTokenBodySchema),
  registerPendingPushToken,
);
r.post(
  "/attach-referrer",
  validateReq("body", AttachReferrerBodySchema),
  attachReferrer,
);

// 3 — promote the pending account to an Advertiser (bare account; business
// setup follows on the authenticated account).
r.post(
  "/finish-registration",
  validateReq("body", FinishRegistrationBodySchema),
  finishRegistration,
);

// Launch-time resume resolver (not a register step) — where to drop a user back
// into onboarding from a stored registrationToken.
r.get(
  "/check-registration",
  validateReq("query", CheckRegistrationQuerySchema),
  checkRegistration,
);

export default r;
