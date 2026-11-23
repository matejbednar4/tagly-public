import { Router } from "express";
import {
  SetupPaygCardBodySchema,
  ReconcilePaygCardBodySchema,
  SetupSavedCardBodySchema,
  ReconcileSavedCardBodySchema,
  EnablePaygBodySchema,
  SetMonthlyBudgetBodySchema,
  CreateCreditPurchaseBodySchema,
  GetCreditPurchaseStatusParamsSchema,
} from "@tagly/models/v2/advertiserApp";
import { validateReq } from "../../../../../middleware/request/validateRequest.js";
import { blockDuringShutdown } from "../../../../../middleware/shutdown/blockDuringShutdown.js";
import { setupPaygCard } from "../../../../../controllers/v2/advertiserApp/billing/payg/setupPaygCard.js";
import { getPaygState } from "../../../../../controllers/v2/advertiserApp/billing/payg/getPaygState.js";
import { removePaygCard } from "../../../../../controllers/v2/advertiserApp/billing/payg/removePaygCard.js";
import { disablePayg } from "../../../../../controllers/v2/advertiserApp/billing/payg/disablePayg.js";
import { enablePayg } from "../../../../../controllers/v2/advertiserApp/billing/payg/enablePayg.js";
import { setupSavedCard } from "../../../../../controllers/v2/advertiserApp/billing/paymentMethod/setupSavedCard.js";
import { reconcileSavedCard } from "../../../../../controllers/v2/advertiserApp/billing/paymentMethod/reconcileSavedCard.js";
import { getSavedCard } from "../../../../../controllers/v2/advertiserApp/billing/paymentMethod/getSavedCard.js";
import { removeSavedCard } from "../../../../../controllers/v2/advertiserApp/billing/paymentMethod/removeSavedCard.js";
import { getMonthlyBudget } from "../../../../../controllers/v2/advertiserApp/billing/monthlyBudget/getMonthlyBudget.js";
import { setMonthlyBudget } from "../../../../../controllers/v2/advertiserApp/billing/monthlyBudget/setMonthlyBudget.js";
import { disableMonthlyBudget } from "../../../../../controllers/v2/advertiserApp/billing/monthlyBudget/disableMonthlyBudget.js";
import { createCreditPurchase } from "../../../../../controllers/v2/advertiserApp/billing/createCreditPurchase.js";
import { settleNegativeBalance } from "../../../../../controllers/v2/advertiserApp/billing/settleNegativeBalance.js";
import { getCreditPurchaseStatus } from "../../../../../controllers/v2/advertiserApp/billing/getCreditPurchaseStatus.js";

/**
 * `/v2/advertisers/me/billing/**` — the PaymentSheet billing surface:
 *
 * Three resources, each with exactly read / add / remove and nothing else:
 *
 * - `/payment-method` — the account's ONE saved off-session card, shared by
 *   both card-charging features: `GET` (live from Stripe), add = the two-step
 *   PaymentSheet handshake (`POST setup-intent` → `POST reconcile`), `DELETE`
 *   (closes BOTH feature periods). Linking is feature-agnostic.
 * - `/payg` — pay-as-you-go: `GET` state, `POST` turn on (saved card
 *   required), `DELETE` turn off (card kept).
 * - `/monthly-budget` — the recurring top-up to a target on the 1st: `GET`
 *   state, `PUT` set (opens a period and tops up to it now), `DELETE` turn off
 *   (card kept).
 * - `/credit-purchases`, `/settle-balance` — prepaid top-ups (PaymentIntent).
 *
 * The `@deprecated` `/payg/setup-intent`, `/payg/reconcile` and
 * `/payg/payment-method` routes are the pre-2026-09 card-link/unlink URLs
 * (link + turn PAYG on in one step); only old builds call them.
 *
 * Crediting / card-saving is mirrored by the permanent Stripe webhooks; these
 * endpoints are the client-driven halves.
 *
 * @shutdown (2026-10 wind-down): in production, every route except GET and
 * DELETE is closed by `blockDuringShutdown` (router-level guard below).
 */
const r = Router();

// @shutdown: no new money in (purchases, settle-balance, top-up/PAYG enable, card
// link). GETs keep the billing screens loading; DELETEs let a business turn its
// own top-up / PAYG off or remove its card.
r.use((req, res, next) =>
  req.method === "GET" || req.method === "DELETE"
    ? next()
    : blockDuringShutdown(req, res, next),
);

// Full PAYG state for the manage sheet (pure read — GETs skip the gentle limiter).
r.get("/payg", getPaygState);
// @deprecated back-compat: the pre-2026-09 PAYG card-link starter.
r.post(
  "/payg/setup-intent",
  validateReq("body", SetupPaygCardBodySchema),
  setupPaygCard,
);
// @deprecated back-compat: the pre-2026-09 reconcile URL — same handler as
// /payment-method/reconcile (a legacy `payg_setup` intent also opens the period).
r.post(
  "/payg/reconcile",
  validateReq("body", ReconcilePaygCardBodySchema),
  reconcileSavedCard,
);
// Turn PAYG on with the saved card already on file (no PaymentSheet).
r.post("/payg", validateReq("body", EnablePaygBodySchema), enablePayg);
// Turn PAYG off, keep the saved card.
r.delete("/payg", disablePayg);
// @deprecated back-compat: the pre-2026-09 unlink URL (same effect as
// DELETE /payment-method). Remove with the legacy setup-intent route.
r.delete("/payg/payment-method", removePaygCard);

// The saved off-session card: read, link (two-step PaymentSheet handshake),
// unlink (closes BOTH feature periods).
r.get("/payment-method", getSavedCard);
r.delete("/payment-method", removeSavedCard);
r.post(
  "/payment-method/setup-intent",
  validateReq("body", SetupSavedCardBodySchema),
  setupSavedCard,
);
r.post(
  "/payment-method/reconcile",
  validateReq("body", ReconcileSavedCardBodySchema),
  reconcileSavedCard,
);

// Monthly budget (pure read).
r.get("/monthly-budget", getMonthlyBudget);
r.put(
  "/monthly-budget",
  validateReq("body", SetMonthlyBudgetBodySchema),
  setMonthlyBudget,
);
r.delete("/monthly-budget", disableMonthlyBudget);

r.post(
  "/credit-purchases",
  validateReq("body", CreateCreditPurchaseBodySchema),
  createCreditPurchase,
);
// Settle a negative available balance (uncollectable PAYG debt). No body — the
// amount is server-computed from the debt; reuses the credit-purchase pipeline.
r.post("/settle-balance", settleNegativeBalance);
// Post-payment verification poll (pure read — GETs skip the gentle limiter).
r.get(
  "/credit-purchases/:uid",
  validateReq("params", GetCreditPurchaseStatusParamsSchema),
  getCreditPurchaseStatus,
);

export default r;
