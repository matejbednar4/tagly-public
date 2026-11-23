import type Stripe from "stripe";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import { refundAdvertiserCreditPurchase } from "../../../ledger/events/creditPurchase/refundAdvertiserCreditPurchase.js";
import type { PendingAdvertiserNotification } from "../types.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { STRIPE_PAYMENT_PURPOSE } from "../../paymentMetadataPurpose.js";
import { recalcCreditPurchaseRefundStatus } from "./recalcCreditPurchaseRefundStatus.js";

/**
 * Handles refund.created and refund.updated events for advertiser charges —
 * both prepaid credit purchases (purpose "credit_purchase") and PAYG
 * off-session settlement charges (purpose "payg_share"). Stripe is the source
 * of truth: if it refunded the charge, we must book it.
 *
 * Flow:
 * 1. Only processes succeeded refunds (ignores pending/failed)
 * 2. Validates this is a credit_purchase / payg_share PaymentIntent refund
 * 3. Finds StripeCreditPurchase by PI id or UID
 * 4. Creates CREDIT_PURCHASE_REFUND ledger event (idempotent on refund id)
 * 5. Aggregates total refunds to determine REFUNDED vs PARTIALLY_REFUNDED status
 * 6. Returns notification payload for advertiser
 *
 * PAYG reuses the exact same credit-purchase refund path. That path nets to
 * `available −refund` (lock available→locked, then consume locked), so for a
 * PAYG charge — whose money already flowed straight through to a customer payout
 * — the advertiser's available budget goes negative: an uncollectable
 * receivable, the same model as the decline / no-card settlement paths in
 * settlePaygShare. The customer keeps their payout; we never claw it back.
 *
 * Currency invariants are enforced to prevent money mismatches.
 */
export async function handleRefundEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<PendingAdvertiserNotification> {
  const refund = event.data.object as Stripe.Refund;

  // 1) We only care about completed refunds
  if (refund.status !== "succeeded") {
    return null;
  }

  const refundAmount = refund.amount;
  if (!refundAmount || refundAmount <= 0) {
    return null;
  }

  // 2) Extract PaymentIntent ID
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;

  if (!paymentIntentId) {
    return null;
  }

  // Optional: if the refund payload has an expanded PI, use its metadata as a guard
  let piPurpose: string | undefined;
  let piCreditPurchaseUid: string | undefined;

  if (typeof refund.payment_intent !== "string" && refund.payment_intent) {
    const piObj = refund.payment_intent as Stripe.PaymentIntent;
    piPurpose = (piObj.metadata?.purpose ?? "").toString();
    piCreditPurchaseUid = piObj.metadata?.creditPurchaseUid?.toString();
  }

  if (
    piPurpose &&
    piPurpose !== STRIPE_PAYMENT_PURPOSE.CREDIT_PURCHASE &&
    piPurpose !== STRIPE_PAYMENT_PURPOSE.MONTHLY_BUDGET_TOPUP &&
    piPurpose !== STRIPE_PAYMENT_PURPOSE.PAYG_SHARE
  ) {
    // PI refund for something we don't book here – ignore in this handler
    return null;
  }

  // 3) Find StripeCreditPurchase by PI (canonical), fallback by UID (Checkout case)
  let creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      advertiser: { select: { id: true } },
    },
  });

  if (!creditPurchase && piCreditPurchaseUid) {
    creditPurchase = await tx.stripeCreditPurchase.findUnique({
      where: { uid: piCreditPurchaseUid },
      include: { advertiser: { select: { id: true } } },
    });

    if (creditPurchase && !creditPurchase.stripePaymentIntentId) {
      creditPurchase = await tx.stripeCreditPurchase.update({
        where: { id: creditPurchase.id },
        data: { stripePaymentIntentId: paymentIntentId },
        include: { advertiser: { select: { id: true } } },
      });
    }
  }

  if (!creditPurchase) {
    // Stripe refunded money we can't tie to a purchase → the ledger can't mirror
    // it. Alert.
    throw createCustomError(4400, "credit_purchase not found for refund", {
      status: 500,
      notify: true,
      notifyKey: `refund-purchase-not-found:${refund.id}`,
    });
  }

  // PAYG charges (kind PAYG_CHARGE) take the same refund path as prepaid credit
  // purchases below — see the docblock. The money already flowed to a customer
  // payout, so booking the refund drives the advertiser's available budget
  // negative (an uncollectable receivable). Stripe already moved the money; our
  // job is to mirror it, not block it.

  // Extra safety: metadata vs DB UID if metadata is present
  if (piCreditPurchaseUid && creditPurchase.uid !== piCreditPurchaseUid) {
    throw createCustomError(4401, "credit_purchase mismatch for refund", {
      status: 500,
      notify: true,
      notifyKey: `refund-purchase-mismatch:${refund.id}`,
    });
  }

  const advertiserId = creditPurchase.advertiserId;
  const currency = creditPurchase.currency;

  if (!advertiserId) {
    throw createCustomError(4403, "credit_purchase advertiserId missing", {
      status: 500,
      notify: true,
      notifyKey: `refund-advertiser-missing:${refund.id}`,
    });
  }

  // 3b) Currency sanity check (Stripe should never violate this). Unconditional
  // — a missing refund.currency would mean Stripe's SDK type loosened in a way
  // we shouldn't silently no-op around.
  const refundCurrency = refund.currency?.toLowerCase?.() ?? "";
  if (refundCurrency !== currency) {
    throw createCustomError(4402, "refund currency mismatch", {
      status: 500,
      notify: true,
      notifyKey: `refund-currency-mismatch:${refund.id}`,
    });
  }

  // 4) Create / reuse refund ledger event (idempotent on Stripe refund id).
  //    refundAdvertiserCreditPurchase ensures funds are locked first (creates
  //    a CREDIT_PURCHASE_REFUND_LOCK if one doesn't already exist from admin),
  //    then always deducts from locked budget.
  const { event: refundLedgerEvent } = await refundAdvertiserCreditPurchase(
    tx,
    {
      advertiserId,
      refundCents: refundAmount,
      creditPurchaseUid: creditPurchase.uid,
      stripePaymentIntentId: paymentIntentId,
      stripeRefundId: refund.id,
      meta: {
        stripe: {
          refundId: refund.id,
          paymentIntentId,
        },
      },
      stripeCreditPurchaseId: creditPurchase.id,
      enforceBalance: false,
    }
  );

  // 5+6) Re-derive REFUNDED / PARTIALLY_REFUNDED from the ledger and persist —
  //      shared with the dispute handler so the status math can't drift.
  await recalcCreditPurchaseRefundStatus(tx, {
    id: creditPurchase.id,
    uid: creditPurchase.uid,
    amountCents: creditPurchase.amountCents,
    advertiserId,
    status: creditPurchase.status,
  });

  // 7) Notify advertiser
  return {
    eventSlug: "a.balance.credit-purchase-refunded",
    payload: {
      amountCents: refundAmount,
      currency,
      stripe: {
        refundId: refund.id,
        paymentIntentId,
        creditPurchaseUid: creditPurchase.uid,
        ledgerEventId: refundLedgerEvent.id,
      },
    },
    dedupeKey: `credit_purchase_refund_${refund.id}`,
    advertiserIds: [advertiserId],
  };
}
