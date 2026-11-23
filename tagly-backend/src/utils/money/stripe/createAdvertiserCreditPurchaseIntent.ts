import type Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { STRIPE_PAYMENT_PURPOSE } from "./paymentMetadataPurpose.js";
import { generateUid } from "../../core/uids/generateUid.js";
import { ensureStripeCustomerForAdvertiser } from "./ensureStripeCustomerForAdvertiser.js";
import { envVariables } from "../../../environment/envVariables.js";

/** The native PaymentSheet handoff for a freshly-created credit purchase. */
export interface CreditPurchaseIntent {
  /** The PENDING purchase this payment funds. */
  creditPurchaseUid: string;
  /** Client secret the PaymentSheet confirms (payment mode). */
  paymentIntentClientSecret: string;
  /** The advertiser's Stripe customer id (PaymentSheet customer mode). */
  customerId: string;
  /** Short-lived key letting the PaymentSheet act on the customer. */
  ephemeralKeySecret: string;
}

/**
 * Create a prepaid `CREDIT_PURCHASE` (PENDING row + bare PaymentIntent) for the
 * native PaymentSheet, and return its handoff. The shared core of every v2
 * credit-purchase controller — a plain top-up (`createCreditPurchase`, client
 * amount, $50 floor) and settling a negative balance (`settleNegativeBalance`,
 * server-computed amount = the debt). The **amount is the ONLY thing that
 * differs** between callers; everything downstream (metadata, webhook
 * `handlePaymentIntentSucceeded`, reconcile worker, ledger crediting) is
 * amount-agnostic and keyed on `purpose: "credit_purchase"` + `creditPurchaseUid`,
 * so both flows book identically.
 *
 * Sequence (unchanged from the original inline controller):
 *  1. Create the `StripeCreditPurchase` row FIRST (PENDING) — the webhook's
 *     amount/currency invariants compare against it.
 *  2. Create the PaymentIntent on the advertiser's Stripe customer with the
 *     metadata the permanent `handlePaymentIntentSucceeded` matches on, idempotent
 *     per uid. Any Stripe failure marks the row FAILED for audit.
 *  3. Write the PI id back onto the row (the webhook's primary match key).
 *
 * The caller is responsible for validating/deriving `amountCents` (bounds, the
 * Stripe minimum). This util assumes it's already a valid USD-cent charge amount.
 */
export async function createAdvertiserCreditPurchaseIntent(
  advertiserId: number,
  amountCents: number,
): Promise<CreditPurchaseIntent> {
  const forcedCurrency = "usd";

  const advertiser = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { email: true, uid: true },
  });
  if (!advertiser) throw createCustomError(1304, "advertiser not found", 404);

  const stripeCustomerId = await ensureStripeCustomerForAdvertiser(advertiserId);

  const creditPurchaseUid = generateUid("CREDIT_PURCHASE");

  // 1) Create DB row FIRST.
  const creditPurchase = await prisma.stripeCreditPurchase.create({
    data: {
      uid: creditPurchaseUid,
      advertiserId,
      currency: forcedCurrency,
      amountCents: BigInt(amountCents),
      kind: "CREDIT_PURCHASE",
      status: "PENDING",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    },
    select: { id: true },
  });

  // 2) Ephemeral key + PaymentIntent. Any Stripe failure marks the row FAILED
  // for audit (don't silently leave it pending forever).
  let paymentIntent: Stripe.PaymentIntent;
  let ephemeralKey: Stripe.EphemeralKey;
  try {
    ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: stripeCustomerId },
      { apiVersion: envVariables.STRIPE_API_VERSION_SERVER },
    );
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: forcedCurrency,
        customer: stripeCustomerId,
        receipt_email: advertiser.email,
        // Cards + native wallets (Apple/Google Pay) in the PaymentSheet.
        automatic_payment_methods: { enabled: true },
        metadata: {
          advertiserUid: advertiser.uid,
          advertiserId: String(advertiserId),
          purpose: STRIPE_PAYMENT_PURPOSE.CREDIT_PURCHASE,
          creditPurchaseUid,
        },
      },
      { idempotencyKey: `credit_purchase_${creditPurchaseUid}` },
    );
  } catch (err: any) {
    await prisma.stripeCreditPurchase.update({
      where: { id: creditPurchase.id },
      data: {
        status: "FAILED",
        failureCode: err?.code?.toString?.() ?? null,
        failureMessage:
          err?.message?.toString?.() ?? "payment intent creation failed",
      },
    });
    throw createCustomError(1306, "payment intent failed", 500);
  }

  if (!paymentIntent.client_secret || !ephemeralKey.secret) {
    throw createCustomError(1306, "payment intent failed", 500);
  }

  // 3) Write the PI id back — the webhook's primary match key.
  await prisma.stripeCreditPurchase.update({
    where: { id: creditPurchase.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return {
    creditPurchaseUid,
    paymentIntentClientSecret: paymentIntent.client_secret,
    customerId: stripeCustomerId,
    ephemeralKeySecret: ephemeralKey.secret,
  };
}
