import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { createAdvertiserCreditPurchaseIntent } from "../../../../utils/money/stripe/createAdvertiserCreditPurchaseIntent.js";
import { STRIPE_MIN_CHARGE_CENTS } from "../../../../constants/billing/STRIPE.js";
import type { SettleNegativeBalanceResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/settle-balance` — pay off a negative
 * available balance. A negative balance is an uncollectable PAYG receivable: a
 * share settled (the customer was paid in full) while the card was gone, so the
 * advertiser's available budget went negative and the account is invisible to
 * customers. There's no way to earn it back to zero, so this lets them clear it.
 *
 * It is a **credit purchase like any other** — the amount is just server-computed
 * (the debt) instead of client-chosen, and there's no $50 floor. Everything
 * downstream is shared verbatim with `createCreditPurchase`: the PENDING row +
 * PaymentIntent (`createAdvertiserCreditPurchaseIntent`), the
 * `payment_intent.succeeded` webhook, the reconcile worker, and the
 * `CREDIT_PURCHASE` ledger crediting. Paying the debt brings available back to
 * zero (visibility re-derives once the ledger books it).
 *
 * The charge is the magnitude of the negative balance, floored at Stripe's
 * minimum charge ($0.50) — if the debt is smaller than that, the tiny remainder
 * lands as credit. The amount is computed here (never client-supplied) so a
 * client can't dictate the settle amount; the response echoes it so the sheet
 * can show what's being charged. No request body.
 */
export const settleNegativeBalance: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        sensitiveData: { select: { availableBudgetUsdCents: true } },
      },
    });
    if (!advertiser) throw createCustomError(1304, "advertiser not found", 404);

    const availableCents = advertiser.sensitiveData.availableBudgetUsdCents;
    // Nothing owed — stale UI, or another device/webhook already settled it.
    if (availableCents >= 0n) {
      throw createCustomError(1318, "no negative balance to settle", 409);
    }

    // Charge the debt, floored at Stripe's minimum. `availableCents` is a BigInt;
    // realistic debts sit well within a safe JS integer.
    const owedCents = -availableCents;
    const amountCents = Math.max(Number(owedCents), STRIPE_MIN_CHARGE_CENTS);

    const intent = await createAdvertiserCreditPurchaseIntent(
      advertiserId,
      amountCents,
    );

    res.status(201).json({
      ...intent,
      amountCents,
    } satisfies SettleNegativeBalanceResponse);
  },
);
