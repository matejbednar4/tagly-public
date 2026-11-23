import type Stripe from "stripe";
import {
  CreditPurchaseStatus,
  TransactionKind,
  type Prisma,
} from "../../../../../generated/prisma/client.js";
import { createAdvertiserCreditPurchase } from "../../../ledger/events/creditPurchase/createAdvertiserCreditPurchaseEvent.js";
import type { PendingAdvertiserNotification } from "../types.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { CREDIT_PURCHASE_PURPOSES } from "../../paymentMetadataPurpose.js";

/**
 * Handles payment_intent.succeeded events for credit purchases — both the
 * PaymentSheet top-up (`credit_purchase`) and the off-session monthly-budget
 * top-up (`monthly_budget_topup`), which is booked identically. For the
 * latter this is the mirror of `runMonthlyBudgetTopUp`'s own booking: both
 * write the ledger under `stripe_pi_{id}`, so whichever lands first wins.
 *
 * Flow:
 * 1. Validates this is a credit-purchase-class PaymentIntent via metadata
 * 2. Finds StripeCreditPurchase by PI id or UID (Checkout fallback)
 * 3. Creates/reuses CREDIT_PURCHASE ledger event (idempotent on externalRef)
 * 5. Marks StripeCreditPurchase as COMPLETED
 * 6. Sets default payment method if none exists
 * 7. Returns notification payload for advertiser
 *
 * Amount/currency invariants are enforced to prevent money mismatches.
 */
export async function handlePaymentIntentSucceeded(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<PendingAdvertiserNotification> {
  const pi = event.data.object as Stripe.PaymentIntent;

  const piCurrency = pi.currency?.toLowerCase?.();

  const rawAmount =
    typeof pi.amount_received === "number" && pi.amount_received > 0
      ? pi.amount_received
      : pi.amount;

  if (!piCurrency || !rawAmount || !pi.id) {
    return null;
  }

  // Only process credit-purchase-class PIs (top-up + monthly-budget top-up).
  const purpose = (pi.metadata?.purpose ?? "").toString();
  if (!CREDIT_PURCHASE_PURPOSES.has(purpose)) {
    return null;
  }

  const creditPurchaseUidMeta = pi.metadata?.creditPurchaseUid?.toString();
  const advertiserIdMeta = pi.metadata?.advertiserId
    ? Number(pi.metadata.advertiserId)
    : undefined;

  // Stripe customer, if present
  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id;

  // 1) Find StripeCreditPurchase for this PI
  let creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: {
      uid: true,
      id: true,
      stripeChargeId: true,
      stripePaymentIntentId: true,
      advertiserId: true,
      amountCents: true,
      currency: true,
      status: true,
    },
  });

  // Checkout case: we may have created the purchase before PI existed, so fallback by UID.
  if (!creditPurchase && creditPurchaseUidMeta) {
    creditPurchase = await tx.stripeCreditPurchase.findUnique({
      where: { uid: creditPurchaseUidMeta },
    });

    if (creditPurchase) {
      // Persist PI id for canonical mapping
      if (!creditPurchase.stripePaymentIntentId) {
        creditPurchase = await tx.stripeCreditPurchase.update({
          where: { id: creditPurchase.id },
          data: { stripePaymentIntentId: pi.id },
          select: {
            uid: true,
            id: true,
            stripeChargeId: true,
            stripePaymentIntentId: true,
            advertiserId: true,
            amountCents: true,
            currency: true,
            status: true,
          },
        });
      } else {
        // Ensure select shape matches
        creditPurchase = {
          uid: creditPurchase.uid,
          id: creditPurchase.id,
          stripeChargeId: creditPurchase.stripeChargeId,
          stripePaymentIntentId: creditPurchase.stripePaymentIntentId,
          advertiserId: creditPurchase.advertiserId,
          amountCents: creditPurchase.amountCents,
          currency: creditPurchase.currency,
          status: creditPurchase.status,
        };
      }
    }
  }

  // Last-resort reconstruction (should be rare). Only do this if metadata is complete.
  if (!creditPurchase) {
    if (!advertiserIdMeta || !creditPurchaseUidMeta) {
      // Advertiser was charged (PI succeeded) but we have no record AND no
      // metadata to reconstruct it → the deposit is unbookable. Alert.
      throw createCustomError(
        4300,
        "creditPurchase not found for payment intent",
        {
          status: 500,
          notify: true,
          notifyKey: `deposit-pi-unbookable:${pi.id}`,
        },
      );
    }

    creditPurchase = await tx.stripeCreditPurchase.create({
      data: {
        uid: creditPurchaseUidMeta,
        advertiserId: advertiserIdMeta,
        currency: piCurrency,
        amountCents: BigInt(rawAmount),
        kind: "CREDIT_PURCHASE",
        stripePaymentIntentId: pi.id,
        status: CreditPurchaseStatus.PENDING,
      },
      select: {
        uid: true,
        id: true,
        stripeChargeId: true,
        stripePaymentIntentId: true,
        advertiserId: true,
        amountCents: true,
        currency: true,
        status: true,
      },
    });
  }

  // Sanity checks: Stripe <-> DB invariant. The advertiser was charged, so any
  // mismatch here means a paid deposit we can't safely book → track AND alert.
  if (creditPurchase.amountCents !== BigInt(rawAmount)) {
    throw createCustomError(4303, "pi amount mismatch credit_purchase", {
      status: 500,
      notify: true,
      notifyKey: `deposit-pi-amount-mismatch:${pi.id}`,
    });
  }

  if (piCurrency !== creditPurchase.currency) {
    throw createCustomError(4304, "pi currency mismatch credit_purchase", {
      status: 500,
      notify: true,
      notifyKey: `deposit-pi-currency-mismatch:${pi.id}`,
    });
  }

  if (!creditPurchase.advertiserId) {
    throw createCustomError(
      4305,
      "credit_purchase advertiserId missing credit_purchase",
      {
        status: 500,
        notify: true,
        notifyKey: `deposit-pi-advertiser-missing:${pi.id}`,
      },
    );
  }

  if (creditPurchaseUidMeta && creditPurchase.uid !== creditPurchaseUidMeta) {
    throw createCustomError(
      4301,
      "creditPurchaseUid mismatch for payment intent",
      {
        status: 500,
        notify: true,
        notifyKey: `deposit-pi-uid-mismatch:${pi.id}`,
      },
    );
  }

  const externalRef = `stripe_pi_${pi.id}`;

  // 2) Idempotency: if a CreditPurchase ledger event already exists, reuse it.
  const existingLedger = await tx.transactionLedgerEvent.findFirst({
    where: {
      OR: [
        {
          externalRef,
          kind: TransactionKind.CREDIT_PURCHASE,
        },
        {
          stripeCreditPurchaseId: creditPurchase.id,
          kind: TransactionKind.CREDIT_PURCHASE,
        },
      ],
    },
    select: { id: true },
  });

  let ledgerEventId = existingLedger?.id ?? null;

  // 3) Create ledger event if missing, linking it to this StripeCreditPurchase
  if (!ledgerEventId) {
    const created = await createAdvertiserCreditPurchase(tx, {
      advertiserId: creditPurchase.advertiserId,
      deltaAdvertiserCents: creditPurchase.amountCents,
      externalRef,
      meta: {
        stripe: {
          paymentIntentId: pi.id,
          stripeCustomerId: customerId,
          creditPurchaseUid: creditPurchase.uid,
        },
      },
      stripeCreditPurchaseId: creditPurchase.id,
    });

    ledgerEventId = created.event.id;
  }

  // 4) Capture charge id if available
  let stripeChargeId: string | undefined;

  // Stripe webhook includes charges[], but Stripe TS types do not.
  const charges = ((pi as any).charges?.data ?? []) as Array<{ id?: string }>;

  if (charges && charges.length > 0) {
    const latestCharge = charges[charges.length - 1];
    if (latestCharge?.id) {
      stripeChargeId = latestCharge.id;
    }
  }

  const isAlreadyRefunded =
    creditPurchase.status === CreditPurchaseStatus.REFUNDED ||
    creditPurchase.status === CreditPurchaseStatus.PARTIALLY_REFUNDED;

  // 5) Mark creditPurchase as completed (or keep refunded status) and store charge id
  await tx.stripeCreditPurchase.update({
    where: { id: creditPurchase.id },
    data: {
      status: isAlreadyRefunded
        ? creditPurchase.status
        : CreditPurchaseStatus.COMPLETED,
      stripeChargeId: stripeChargeId ?? creditPurchase.stripeChargeId,
      stripePaymentIntentId: creditPurchase.stripePaymentIntentId ?? pi.id,
      failureCode: null,
      failureMessage: null,
    },
  });

  // 6) Default payment method if missing (same logic as before)
  if (customerId) {
    const pmId =
      typeof pi.payment_method === "string"
        ? pi.payment_method
        : pi.payment_method?.id;

    if (pmId) {
      const adv = await tx.advertiser.findFirst({
        where: { sensitiveData: { stripeCustomerId: customerId } },
        select: {
          sensitiveData: { select: { id: true, defaultPaymentMethodId: true } },
        },
      });

      if (adv?.sensitiveData?.id && !adv.sensitiveData.defaultPaymentMethodId) {
        await tx.advertiserSensitiveData.update({
          where: { id: adv.sensitiveData.id },
          data: { defaultPaymentMethodId: pmId },
        });
      }
    }
  }

  // 7) No completion notification (removed 2026-07-25): the purchase flow ends
  // with an in-sheet verified success beat, so a push here was redundant. The
  // failure/refund paths still notify.
  return null;
}
