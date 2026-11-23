import type Stripe from "stripe";
import {
  type Prisma,
  CreditPurchaseStatus,
} from "../../../../../generated/prisma/client.js";
import type { PendingAdvertiserNotification } from "../types.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import {
  CREDIT_PURCHASE_PURPOSES,
  STRIPE_PAYMENT_PURPOSE,
} from "../../paymentMetadataPurpose.js";

/**
 * Handles payment_intent.payment_failed and payment_intent.canceled events.
 *
 * Flow:
 * 1. Validates this is a credit-purchase-class PaymentIntent via metadata
 * 2. Finds StripeCreditPurchase by PI id or UID (Checkout fallback)
 * 3. Skips if already in terminal state (idempotent)
 * 4. Updates status to FAILED or CANCELED based on event type
 * 5. Records failure details from Stripe for debugging
 * 6. Returns notification payload for advertiser — EXCEPT for the monthly-budget
 *    top-up (`monthly_budget_topup`): its decline is owned by
 *    `runMonthlyBudgetTopUp`'s retry ladder, which sends its own copy only once
 *    the attempts are exhausted; the generic "top-up failed" email would be
 *    wrong (and premature) there.
 */
export async function handlePaymentIntentFailed(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<PendingAdvertiserNotification> {
  const pi = event.data.object as Stripe.PaymentIntent;

  if (!pi.id) {
    return null;
  }

  const type = event.type;

  // Only touch credit-purchase-class PIs
  const purpose = (pi.metadata?.purpose ?? "").toString();
  if (!CREDIT_PURCHASE_PURPOSES.has(purpose)) {
    return null;
  }

  const creditPurchaseUidMeta = pi.metadata?.creditPurchaseUid?.toString();

  // Checkout case: StripeCreditPurchase may exist with stripePaymentIntentId = null.
  // Prefer PI mapping, but fallback to UID mapping from metadata.
  let creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { stripePaymentIntentId: pi.id },
  });

  if (!creditPurchase && creditPurchaseUidMeta) {
    creditPurchase = await tx.stripeCreditPurchase.findUnique({
      where: { uid: creditPurchaseUidMeta },
    });

    // Persist PI id for future canonical lookups
    if (creditPurchase && !creditPurchase.stripePaymentIntentId) {
      creditPurchase = await tx.stripeCreditPurchase.update({
        where: { id: creditPurchase.id },
        data: { stripePaymentIntentId: pi.id },
      });
    }
  }

  if (!creditPurchase) {
    throw createCustomError(
      4301,
      "credit purchase not found for failed PI",
      500
    );
  }

  if (creditPurchaseUidMeta && creditPurchase.uid !== creditPurchaseUidMeta) {
    throw createCustomError(4302, "credit purchase mismatch for failed PI", 500);
  }

  if (!creditPurchase.advertiserId) {
    throw createCustomError(
      4303,
      "credit purchase not linked to an advertiser",
      500
    );
  }

  // If already terminal, don't overwrite (idempotency)
  if (
    creditPurchase.status === CreditPurchaseStatus.COMPLETED ||
    creditPurchase.status === CreditPurchaseStatus.REFUNDED ||
    creditPurchase.status === CreditPurchaseStatus.PARTIALLY_REFUNDED ||
    creditPurchase.status === CreditPurchaseStatus.FAILED ||
    creditPurchase.status === CreditPurchaseStatus.CANCELED
  ) {
    return null;
  }

  const lastError = pi.last_payment_error as
    | {
        code?: string;
        message?: string;
      }
    | undefined;

  let newStatus: CreditPurchaseStatus;
  if (type === "payment_intent.canceled") {
    newStatus = CreditPurchaseStatus.CANCELED;
  } else {
    newStatus = CreditPurchaseStatus.FAILED;
  }

  await tx.stripeCreditPurchase.update({
    where: { id: creditPurchase.id },
    data: {
      status: newStatus,
      failureCode: lastError?.code ?? creditPurchase.failureCode,
      failureMessage: lastError?.message ?? creditPurchase.failureMessage,
    },
  });

  // The monthly-budget run owns its decline notifications (see docblock).
  if (purpose === STRIPE_PAYMENT_PURPOSE.MONTHLY_BUDGET_TOPUP) {
    return null;
  }

  return {
    eventSlug: "a.balance.credit-purchase-failed",
    payload: {
      amountCents: Number(creditPurchase.amountCents),
      currency: creditPurchase.currency,
      stripe: {
        paymentIntentId: pi.id,
        creditPurchaseUid: creditPurchase.uid,
      },
    },
    dedupeKey: `credit_purchase_${pi.id}`,
    advertiserIds: [creditPurchase.advertiserId],
  };
}