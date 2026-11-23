import { Router } from "express";
import { validateReq } from "../../../../middleware/request/validateRequest.js";
import { OnAppOpenBodySchema } from "@tagly/models/v2/advertiserApp";
import { getMe } from "../../../../controllers/v2/advertiserApp/me/getMe.js";
import { onAppOpen } from "../../../../controllers/v2/advertiserApp/me/onAppOpen.js";
import { getStatistics } from "../../../../controllers/v2/advertiserApp/me/getStatistics.js";
import { getReferrals } from "../../../../controllers/v2/advertiserApp/me/getReferrals.js";
import billingRouter from "./billing/index.js";
import businessesRouter from "./businesses/index.js";
import updateRouter from "./update/index.js";
import securityRouter from "./security/index.js";
import emailRouter from "./email/index.js";
import deleteAccountRouter from "./delete-account/index.js";
import notificationsRouter from "./notifications/index.js";

/**
 * `/v2/advertisers/me/**` — the logged-in advertiser's own resources.
 *   - `GET /`                lean core profile (+ budgets)
 *   - `POST /on-app-open`    fire-and-forget app-open writes (notif + push)
 *   - `GET /statistics`      lifetime statistics (over APPROVED shares)
 *   - `GET /referrals`       referral code/status/counts/earnings
 *   - `/update/**`           profile mutations (language, referral, marketing)
 *   - `/security/**`         session-security actions (sign out other devices)
 *   - `/email/**`            dual-OTP email change
 *   - `/delete-account/**`   OTP-gated account deletion (forfeit budget + delete)
 *   - `/notifications/**`    per-channel notification preferences
 * Auth/capability middleware is applied at the group mount in
 * `routes/v2/index.ts`.
 */
const r = Router();

r.get("/", getMe);
r.post("/on-app-open", validateReq("body", OnAppOpenBodySchema), onAppOpen);
r.get("/statistics", getStatistics);
r.get("/referrals", getReferrals);
r.use("/update", updateRouter);
r.use("/security", securityRouter);
r.use("/email", emailRouter);
r.use("/delete-account", deleteAccountRouter);
r.use("/notifications", notificationsRouter);
r.use("/billing", billingRouter);
r.use("/businesses", businessesRouter);

export default r;
