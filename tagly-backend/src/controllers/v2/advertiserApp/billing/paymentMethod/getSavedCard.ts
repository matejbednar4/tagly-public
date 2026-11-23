import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { stripe } from "../../../../../utils/clients/stripe.js";
import type { GetSavedCardResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/billing/payment-method` — the account's saved
 * off-session card (the ONE card shared by PAYG and the monthly budget), with
 * brand/last4/expiry fetched **live** from Stripe — card details are never
 * stored, and this is the only endpoint that reads them. Pure read; a failed
 * Stripe lookup degrades to `card: null` with `hasCard` still true, so the
 * client can tell "no card" from "lookup failed".
 */
export const getSavedCard: RequestHandler = asyncHandler(async (req, res) => {
  const adv = await prisma.advertiser.findUnique({
    where: { id: req.user.id },
    select: { sensitiveData: { select: { savedPaymentMethodId: true } } },
  });
  if (!adv) throw createCustomError(1304, "advertiser not found", 404);

  const pmId = adv.sensitiveData.savedPaymentMethodId;
  let card: GetSavedCardResponse["card"] = null;
  if (pmId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.card) {
        card = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    } catch {
      card = null;
    }
  }

  res.status(200).json({
    hasCard: pmId != null,
    card,
  } satisfies GetSavedCardResponse);
});
