import { Router } from "express";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import {
  CreateWithdrawalBodySchema,
  GetConnectStatusQuerySchema,
  GetWithdrawalStatusQuerySchema,
} from "@tagly/models/v2/customerApp";
import { startConnectOnboarding } from "../../../../../controllers/v2/customerApp/billing/stripe/startConnectOnboarding.js";
import { getConnectStatus } from "../../../../../controllers/v2/customerApp/billing/stripe/getConnectStatus.js";
import { createExpressDashboardLink } from "../../../../../controllers/v2/customerApp/billing/stripe/createExpressDashboardLink.js";
import { createWithdrawal } from "../../../../../controllers/v2/customerApp/billing/stripe/createWithdrawal.js";
import { getWithdrawalStatus } from "../../../../../controllers/v2/customerApp/billing/stripe/getWithdrawalStatus.js";

/**
 * `/v2/customers/me/cash-out/**` — the customer's payout surface (Stripe Connect
 * onboarding + withdrawals).
 *   - `POST /onboarding`         start Express onboarding, returns a hosted link
 *   - `GET  /connect-status`     sync + return Connect payout readiness
 *   - `POST /dashboard-link`     one-time Express Dashboard login link
 *   - `POST /withdraw`           cash out balance → Connect account
 *   - `GET  /withdrawal-status`  single-withdrawal "did it work?" poll
 *
 * Money-movement routes rely on the group-level `authedUserLimiter` +
 * `gentlePerRouteLimiter` (mounted in `routes/v2/index.ts`).
 */
const r = Router();

r.post("/onboarding", startConnectOnboarding);
r.get(
  "/connect-status",
  validateReq("query", GetConnectStatusQuerySchema),
  getConnectStatus,
);
r.post("/dashboard-link", createExpressDashboardLink);
r.post(
  "/withdraw",
  validateReq("body", CreateWithdrawalBodySchema),
  createWithdrawal,
);
r.get(
  "/withdrawal-status",
  validateReq("query", GetWithdrawalStatusQuerySchema),
  getWithdrawalStatus,
);

export default r;
