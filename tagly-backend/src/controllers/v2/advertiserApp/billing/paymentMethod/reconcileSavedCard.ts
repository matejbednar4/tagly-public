import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { stripe } from "../../../../../utils/clients/stripe.js";
import { linkCardFromSetupIntent } from "../../../../../utils/money/savedCard/linkCardFromSetupIntent.js";
import { openPaygPeriod } from "../../../../../utils/money/payg/openPaygPeriod.js";
import { bumpAdvertiserBudgetGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type {
  ReconcileSavedCardBody,
  ReconcileSavedCardResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/payment-method/reconcile` (also mounted as
 * the deprecated `POST /payg/reconcile`) — confirm a card-link SetupIntent
 * directly with Stripe and save the card. The fast half of a link: polled
 * right after the PaymentSheet succeeds so the app doesn't wait on webhook
 * delivery (the `setup_intent.succeeded` webhook is the guaranteed half —
 * both call `linkCardFromSetupIntent` and are idempotent with each other;
 * whichever runs first wins).
 *
 * Linking is feature-agnostic — turning PAYG / the monthly budget on is their
 * own endpoints. The one exception is the deprecated `payg_setup` intent from
 * pre-2026-09 builds, which expect the link alone to turn PAYG on; for those
 * the period is opened here as a separate step after the link.
 *
 * IDOR-safe: the SetupIntent's Stripe customer must match this advertiser's
 * (1339), and only the off-session card-link purposes are accepted (1340 — a
 * PaymentSheet top-up's card has no off-session mandate and must never become
 * the charged card). An unconfirmed intent reports `linked: false` and writes
 * nothing.
 */
export const reconcileSavedCard: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { setupIntentId } = req.validatedBody as ReconcileSavedCardBody;

    const adv = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        sensitiveData: {
          select: {
            id: true,
            stripeCustomerId: true,
            savedPaymentMethodId: true,
          },
        },
      },
    });
    if (!adv) throw createCustomError(1304, "advertiser not found", 404);
    const {
      id: sensitiveDataId,
      stripeCustomerId,
      savedPaymentMethodId: previousPmId,
    } = adv.sensitiveData;

    let setupIntent;
    try {
      setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
        expand: ["payment_method"],
      });
    } catch {
      throw createCustomError(1339, "setup intent not found", 404);
    }

    // IDOR: the SetupIntent must belong to this advertiser's Stripe customer.
    const intentCustomer =
      typeof setupIntent.customer === "string"
        ? setupIntent.customer
        : setupIntent.customer?.id;
    if (!stripeCustomerId || intentCustomer !== stripeCustomerId) {
      throw createCustomError(
        1339,
        "setup intent not for this advertiser",
        403,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const linked = await linkCardFromSetupIntent(tx, {
        setupIntent,
        sensitiveDataId,
        previousPmId,
      });
      // @deprecated back-compat: legacy PAYG link → also turn PAYG on
      // (idempotent — no-op if a period is already open).
      if (linked.outcome === "LINKED" && linked.legacyPaygSetup) {
        await openPaygPeriod(advertiserId, tx);
      }
      return linked;
    });

    switch (result.outcome) {
      case "FOREIGN_PURPOSE":
        throw createCustomError(1340, "not a card setup intent", 400);
      case "NO_PAYMENT_METHOD":
        throw createCustomError(1340, "no payment method on setup intent", 400);
      case "NOT_SUCCEEDED":
        res
          .status(200)
          .json({ linked: false } satisfies ReconcileSavedCardResponse);
        return;
      case "LINKED":
        break;
    }

    // Detach the replaced card from Stripe after commit (best-effort).
    if (result.replacedPmId) {
      await stripe.paymentMethods.detach(result.replacedPmId).catch(() => {});
    }

    // Legacy PAYG link just went active → estimates for this advertiser's
    // businesses are no longer budget-capped. No ledger event fired, so bump
    // the estimate cache explicitly. Fire-and-forget, fail-open.
    if (result.legacyPaygSetup) {
      void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});
    }

    res.status(200).json({ linked: true } satisfies ReconcileSavedCardResponse);
  },
);
