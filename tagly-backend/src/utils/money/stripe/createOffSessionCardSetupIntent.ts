import type Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import type { StripePaymentPurpose } from "./paymentMetadataPurpose.js";
import { ensureStripeCustomerForAdvertiser } from "./ensureStripeCustomerForAdvertiser.js";
import { envVariables } from "../../../environment/envVariables.js";

/** The native PaymentSheet handoff for a card-link SetupIntent. */
export interface CardSetupIntent {
  setupIntentClientSecret: string;
  setupIntentId: string;
  customerId: string;
  ephemeralKeySecret: string;
}

/**
 * Stamp the off-session charge consent and create a bare `usage:
 * "off_session"` SetupIntent (+ ephemeral key) for the native PaymentSheet.
 * The shared core of the two card-link starters, which differ ONLY in the
 * `purpose` they stamp — what the webhook / reconcile do once the sheet
 * succeeds:
 *
 * - `payg_setup` (`setupPaygCard`): link the card AND open a PaygPeriod.
 * - `card_setup` (`setupSavedCard`): link the card and nothing else — used
 *   when the card is being added for the monthly budget.
 *
 * Consent (`offSessionChargeAuthorizedAt`) is stamped HERE, before the sheet
 * opens — the moment the advertiser explicitly agreed to off-session
 * charging. `reconcile` and the webhook never touch it, so it always reflects
 * the real agreement moment. No card data ever touches our backend; the
 * PaymentSheet collects it.
 */
export async function createOffSessionCardSetupIntent(
  advertiserId: number,
  purpose: StripePaymentPurpose,
): Promise<CardSetupIntent> {
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { uid: true, sensitiveData: { select: { id: true } } },
  });
  if (!adv) throw createCustomError(1304, "advertiser not found", 404);

  await prisma.advertiserSensitiveData.update({
    where: { id: adv.sensitiveData.id },
    data: { offSessionChargeAuthorizedAt: new Date() },
  });

  const stripeCustomerId =
    await ensureStripeCustomerForAdvertiser(advertiserId);

  let setupIntent: Stripe.SetupIntent;
  let ephemeralKey: Stripe.EphemeralKey;
  try {
    setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        advertiserUid: adv.uid,
        advertiserId: String(advertiserId),
        purpose,
      },
    });
    // Short-lived key letting the PaymentSheet act on the customer (list/save
    // payment methods). Created with the server's pinned API version — the
    // mobile SDK accepts any version that supports ephemeral keys.
    ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomerId },
      { apiVersion: envVariables.STRIPE_API_VERSION_SERVER },
    );
  } catch {
    throw createCustomError(1334, "Failed to start card setup", 500);
  }

  if (!setupIntent.client_secret || !ephemeralKey.secret) {
    throw createCustomError(1334, "Failed to start card setup", 500);
  }

  return {
    setupIntentClientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    customerId: stripeCustomerId,
    ephemeralKeySecret: ephemeralKey.secret,
  };
}
