import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createAdvertiserCreditPurchaseIntent } from "../../../../utils/money/stripe/createAdvertiserCreditPurchaseIntent.js";
import type {
  CreateCreditPurchaseBody,
  CreateCreditPurchaseResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/credit-purchases` — start a prepaid credit
 * top-up for the native PaymentSheet: a bare PaymentIntent + ephemeral key
 * (no hosted Checkout Session).
 *
 * The whole PENDING-row + PaymentIntent creation lives in the shared
 * `createAdvertiserCreditPurchaseIntent` (also used by `settleNegativeBalance`,
 * whose only difference is a server-computed amount) — this controller just
 * takes the client amount (bounds enforced by the route schema, min $50) and
 * hands the PaymentSheet payload back.
 *
 * The actual crediting happens via the webhook when `payment_intent.succeeded`
 * fires; an abandoned sheet leaves a PENDING row for the reconcile machinery.
 */
export const createCreditPurchase: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    // Bounds (min $50 / max) are enforced by the route schema.
    const { amountCents } = req.validatedBody as CreateCreditPurchaseBody;

    const intent = await createAdvertiserCreditPurchaseIntent(
      advertiserId,
      amountCents,
    );

    res.status(201).json(intent satisfies CreateCreditPurchaseResponse);
  },
);
