import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import { appOpenPromptLimiter } from "../../../../middleware/security/rateLimit.js";
import { noShareOpportunityDuringShutdown } from "../../../../middleware/shutdown/noShareOpportunityDuringShutdown.js";
import {
  OnAppOpenBodySchema,
  GetShareOpportunityQuerySchema,
} from "@tagly/models/v2/customerApp";
import { getMe } from "../../../../controllers/v2/customerApp/me/getMe.js";
import { onAppOpen } from "../../../../controllers/v2/customerApp/me/onAppOpen.js";
import { getShareOpportunity } from "../../../../controllers/v2/customerApp/me/getShareOpportunity.js";
import { getStatistics } from "../../../../controllers/v2/customerApp/me/getStatistics.js";
import { getReferrals } from "../../../../controllers/v2/customerApp/me/getReferrals.js";
import instagramRouter from "./instagram/index.js";
import cashOutRouter from "./cash-out/index.js";
import updateRouter from "./update/index.js";
import securityRouter from "./security/index.js";
import emailRouter from "./email/index.js";
import deleteAccountRouter from "./delete-account/index.js";
import notificationsRouter from "./notifications/index.js";

/**
 * `/v2/customers/me/**` — the logged-in customer's own resources.
 *   - `GET  /`                 lean core profile (pure read)
 *   - `POST /on-app-open`      fire-and-forget app-open writes (notif + push)
 *   - `GET  /statistics`       lifetime sharing stats (cached)
 *   - `GET  /referrals`        referral code/status/counts/earnings (cached)
 *   - `GET  /share-opportunity` app-open share nudge (in-business + story OCR)
 *                              (@shutdown: always "none" in prod — 2026-10 wind-down)
 *   - `/update/**`             profile mutations (e.g. self-serve region change)
 *   - `/instagram/**`          IG probe + snapshot poll
 *   - `/cash-out/**`           Stripe Connect onboarding + withdrawals
 *   - `/email/**`              dual-OTP email change
 *   - `/delete-account/**`     OTP-gated account deletion (sweep balance + delete)
 *   - `/notifications/**`      per-channel notification preferences
 */
const r = Router();

r.get("/", getMe);
r.post("/on-app-open", validateReq("body", OnAppOpenBodySchema), onAppOpen);
r.get("/statistics", getStatistics);
r.get("/referrals", getReferrals);
// Fetches IG stories + runs Rekognition on a hit, so throttle per-user
// (`appOpenPromptLimiter`: 1 req / 20s) — app-open fires with no client cooldown.
r.get(
  "/share-opportunity",
  noShareOpportunityDuringShutdown, // @shutdown
  appOpenPromptLimiter,
  validateReq("query", GetShareOpportunityQuerySchema),
  getShareOpportunity,
);
r.use("/update", updateRouter);
r.use("/instagram", instagramRouter);
r.use("/cash-out", cashOutRouter);
r.use("/security", securityRouter);
r.use("/email", emailRouter);
r.use("/delete-account", deleteAccountRouter);
r.use("/notifications", notificationsRouter);

export default r;
