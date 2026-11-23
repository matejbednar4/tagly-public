import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  UpdateLanguageBodySchema,
  UpdateReferralCodeBodySchema,
  UpdateReferrerCodeBodySchema,
  UpdateMarketingConsentBodySchema,
} from "@tagly/models/v2/advertiserApp";
import { updateLanguage } from "../../../../../controllers/v2/advertiserApp/me/update/updateLanguage.js";
import { updateReferralCode } from "../../../../../controllers/v2/advertiserApp/me/update/updateReferralCode.js";
import { updateReferrerCode } from "../../../../../controllers/v2/advertiserApp/me/update/updateReferrerCode.js";
import { updateMarketingConsent } from "../../../../../controllers/v2/advertiserApp/me/update/updateMarketingConsent.js";

/**
 * `/v2/advertisers/me/update/**` — mutations to the logged-in advertiser's own
 * profile.
 *   - `POST /language`           set preferred language for server-sent copy (no cooldown)
 *   - `POST /referral-code`      change the own referral code (one-time + uniqueness)
 *   - `POST /referrer-code`      set who referred you (one-time, 24h sign-up window)
 *   - `POST /marketing-consent`  set the promo opt-in (email + push; no cooldown)
 */
const r = Router();

r.post(
  "/language",
  validateReq("body", UpdateLanguageBodySchema),
  updateLanguage,
);
r.post(
  "/referral-code",
  validateReq("body", UpdateReferralCodeBodySchema),
  updateReferralCode,
);
r.post(
  "/referrer-code",
  validateReq("body", UpdateReferrerCodeBodySchema),
  updateReferrerCode,
);
r.post(
  "/marketing-consent",
  validateReq("body", UpdateMarketingConsentBodySchema),
  updateMarketingConsent,
);

export default r;
