import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  StartEmailBodySchema,
  ResendOtpBodySchema,
  VerifyOtpBodySchema,
  GoogleSignInBodySchema,
  AppleSignInBodySchema,
  RegisterPendingPushTokenBodySchema,
  CheckRegistrationQuerySchema,
  SaveMarketingConsentBodySchema,
  AttachReferrerBodySchema,
  SaveProfileBodySchema,
  CompleteRegistrationBodySchema,
  InstagramLoginBodySchema,
} from "@tagly/models/v2/customerApp";
import { startEmail } from "../../../../../controllers/v2/customerApp/auth/register/1.0startEmail.js";
import { resendOtp } from "../../../../../controllers/v2/customerApp/auth/register/1.1resendOtp.js";
import { verifyOtp } from "../../../../../controllers/v2/customerApp/auth/register/1.2verifyOtp.js";
import { googleSignIn } from "../../../../../controllers/v2/customerApp/auth/register/1.3googleSignIn.js";
import { appleSignIn } from "../../../../../controllers/v2/customerApp/auth/register/1.4appleSignIn.js";
import { registerPendingPushToken } from "../../../../../controllers/v2/customerApp/auth/register/2.1registerPendingPushToken.js";
import { checkRegistration } from "../../../../../controllers/v2/customerApp/auth/checkRegistration.js";
import { saveMarketingConsent } from "../../../../../controllers/v2/customerApp/auth/register/2.0saveMarketingConsent.js";
import { attachReferrer } from "../../../../../controllers/v2/customerApp/auth/register/2.2attachReferrer.js";
import { saveProfile } from "../../../../../controllers/v2/customerApp/auth/register/3.saveProfile.js";
import { completeRegistration } from "../../../../../controllers/v2/customerApp/auth/register/4.completeRegistration.js";
import { instagramLogin } from "../../../../../controllers/v2/customerApp/auth/login/instagramLogin.js";

/**
 * `/v2/public/auth/customers` — customer onboarding/login (OTP + Google/Apple).
 * Public; the parent `/auth` mount applies `authIpLimiter`, so every route here
 * inherits the stricter auth IP rate limit. Leaf routes in onboarding-step order
 * (controllers are numbered to match).
 */
const r = Router();

// 1 — entry (create pending account / login)
r.post("/start-email", validateReq("body", StartEmailBodySchema), startEmail);
r.post("/resend-otp", validateReq("body", ResendOtpBodySchema), resendOtp);
r.post("/verify-otp", validateReq("body", VerifyOtpBodySchema), verifyOtp);
r.post("/google", validateReq("body", GoogleSignInBodySchema), googleSignIn);
r.post("/apple", validateReq("body", AppleSignInBodySchema), appleSignIn);
r.post(
  "/pending-push-token",
  validateReq("body", RegisterPendingPushTokenBodySchema),
  registerPendingPushToken,
);
r.get(
  "/check-registration",
  validateReq("query", CheckRegistrationQuerySchema),
  checkRegistration,
);

// 2–4 — onboarding steps
r.post(
  "/save-marketing-consent",
  validateReq("body", SaveMarketingConsentBodySchema),
  saveMarketingConsent,
);
r.post(
  "/attach-referrer",
  validateReq("body", AttachReferrerBodySchema),
  attachReferrer,
);
r.post("/save-profile", validateReq("body", SaveProfileBodySchema), saveProfile);
r.post(
  "/complete-registration",
  validateReq("body", CompleteRegistrationBodySchema),
  completeRegistration,
);

// standalone login
r.post(
  "/instagram-login",
  validateReq("body", InstagramLoginBodySchema),
  instagramLogin,
);

export default r;
