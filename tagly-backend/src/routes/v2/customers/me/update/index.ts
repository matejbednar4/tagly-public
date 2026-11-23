import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  UpdateLocaleBodySchema,
  UpdateLanguageBodySchema,
  UpdateNameBodySchema,
  UpdateGenderBodySchema,
  UpdateInterestsBodySchema,
  UpdateReferralCodeBodySchema,
  UpdateReferrerCodeBodySchema,
  UpdateMarketingConsentBodySchema,
  UpdateEstimatedStoryViewsBodySchema,
} from "@tagly/models/v2/customerApp";
import { updateLocale } from "../../../../../controllers/v2/customerApp/me/update/updateLocale.js";
import { updateLanguage } from "../../../../../controllers/v2/customerApp/me/update/updateLanguage.js";
import { updateName } from "../../../../../controllers/v2/customerApp/me/update/updateName.js";
import { updateGender } from "../../../../../controllers/v2/customerApp/me/update/updateGender.js";
import { updateInterests } from "../../../../../controllers/v2/customerApp/me/update/updateInterests.js";
import { updateReferralCode } from "../../../../../controllers/v2/customerApp/me/update/updateReferralCode.js";
import { updateReferrerCode } from "../../../../../controllers/v2/customerApp/me/update/updateReferrerCode.js";
import { updateMarketingConsent } from "../../../../../controllers/v2/customerApp/me/update/updateMarketingConsent.js";
import { updateEstimatedStoryViews } from "../../../../../controllers/v2/customerApp/me/update/updateEstimatedStoryViews.js";

/**
 * `/v2/customers/me/update/**` — mutations to the logged-in customer's own
 * profile.
 *   - `POST /locale`         self-serve region correction (US↔CZ, pre-onboarding)
 *   - `POST /language`       set preferred language for server-sent copy (no cooldown)
 *   - `POST /name`           update the display name (no cooldown)
 *   - `POST /gender`         update gender (no cooldown)
 *   - `POST /interests`      replace follower interests (60-day cooldown; clearing is free)
 *   - `POST /referral-code`  change the own referral code (one-time + uniqueness)
 *   - `POST /referrer-code`  set who referred you (one-time, 24h sign-up window)
 *   - `POST /marketing-consent`  set the promo opt-in (email + push; no cooldown)
 *   - `POST /estimated-story-views`  set/clear the no-IG reach fallback (server-owned, E062; no cooldown)
 */
const r = Router();

r.post("/locale", validateReq("body", UpdateLocaleBodySchema), updateLocale);
r.post(
  "/language",
  validateReq("body", UpdateLanguageBodySchema),
  updateLanguage,
);
r.post("/name", validateReq("body", UpdateNameBodySchema), updateName);
r.post("/gender", validateReq("body", UpdateGenderBodySchema), updateGender);
r.post(
  "/interests",
  validateReq("body", UpdateInterestsBodySchema),
  updateInterests,
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
r.post(
  "/estimated-story-views",
  validateReq("body", UpdateEstimatedStoryViewsBodySchema),
  updateEstimatedStoryViews,
);

export default r;
