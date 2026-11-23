import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { lockBudgetForCreditPurchaseRefund } from "../../../../utils/money/ledger/events/creditPurchase/lockBudgetForCreditPurchaseRefund.js";
import { unlockBudgetForFailedCreditPurchaseRefund } from "../../../../utils/money/ledger/events/creditPurchase/unlockBudgetForFailedCreditPurchaseRefund.js";
import { stripe } from "../../../../utils/clients/stripe.js";
import { isDefinitiveStripeRejection } from "../../../../utils/money/stripe/stripeErrorClassification.js";
import { TransactionKind } from "../../../../generated/prisma/client.js";
import type {
  AdminCreditPurchaseUidParams,
  AdminRefundCreditPurchaseBody,
  AdminRefundCreditPurchaseResponse,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/credit-purchases/:uid/refund` — refund (part of) a completed
 * advertiser credit purchase back to the card.
 *
 * Flow (lock → Stripe → webhook settles; see ledger events creditPurchase
 * FLOW.md):
 * 1. Guards: purchase exists, has an advertiser, is not a PAYG_CHARGE (that
 *    money flowed straight through to a share payout — nothing to give back),
 *    is COMPLETED/PARTIALLY_REFUNDED, and has a payment intent.
 * 2. In a transaction: compute `maxRefundable` = purchase amount − prior
 *    refunds − still-pending locks, capped at the advertiser's available
 *    budget; place a CREDIT_PURCHASE_REFUND_LOCK (available → locked); then
 *    re-read the balance and roll back if a concurrent movement (settle,
 *    double-submit) pushed it negative — the pre-lock check is read-then-write
 *    and can race.
 * 3. Outside the transaction: `stripe.refunds.create`. On a DEFINITIVE Stripe
 *    rejection (the refund was certainly not created) the lock is released
 *    (CREDIT_PURCHASE_REFUND_UNLOCK, capped at the still-pending lock); on an
 *    AMBIGUOUS failure (timeout / 5xx — the refund may exist and its webhook
 *    would consume this lock) the lock is kept and a `notify` alert pages a
 *    human. If the unlock itself fails, escalate via `notify` — funds are
 *    stuck locked and a human must act.
 *
 * The final CREDIT_PURCHASE_REFUND booking and the purchase-status flip to
 * REFUNDED/PARTIALLY_REFUNDED stay owned by the `refund.succeeded` webhook
 * (`handleRefundEvent`) — this controller never writes purchase status.
 */
export const refundCreditPurchase: RequestHandler = asyncHandler(
  async (req, res) => {
    const adminId = req.user.id;
    const adminUid = req.user.uid;
    const { uid: creditPurchaseUid } =
      req.validatedParams as AdminCreditPurchaseUidParams;
    const { amountCents, reason } =
      req.validatedBody as AdminRefundCreditPurchaseBody;

    const creditPurchase = await prisma.stripeCreditPurchase.findUnique({
      where: { uid: creditPurchaseUid },
      include: {
        advertiser: { select: { id: true, uid: true } },
      },
    });

    if (!creditPurchase) {
      throw createCustomError(4970, "Credit purchase not found", 404);
    }
    if (!creditPurchase.advertiser) {
      throw createCustomError(4971, "Credit purchase has no advertiser", 400);
    }

    // PAYG off-session charges are non-refundable: the money flowed straight
    // through to a share payout, so there's nothing sitting in budget to give
    // back. Block before any lock or Stripe call.
    if (creditPurchase.kind === "PAYG_CHARGE") {
      throw createCustomError(4972, "PAYG charges are non-refundable", 400);
    }

    if (
      creditPurchase.status !== "COMPLETED" &&
      creditPurchase.status !== "PARTIALLY_REFUNDED"
    ) {
      throw createCustomError(
        4973,
        `Credit purchase status is ${creditPurchase.status}, cannot refund`,
        400,
      );
    }

    if (!creditPurchase.stripePaymentIntentId) {
      throw createCustomError(
        4974,
        "Credit purchase has no Stripe payment intent",
        400,
      );
    }

    const advertiserId = creditPurchase.advertiser.id;

    // Validate & lock inside a transaction
    const lockResult = await prisma.$transaction(async (tx) => {
      const adv = await tx.advertiser.findUnique({
        where: { id: advertiserId },
        select: {
          sensitiveData: { select: { availableBudgetUsdCents: true } },
        },
      });
      if (!adv?.sensitiveData) {
        throw createCustomError(4975, "Advertiser budgets missing", 500);
      }
      const availableBudget = adv.sensitiveData.availableBudgetUsdCents;

      // Already refunded for this purchase (from available and from locked)
      const refundAgg = await tx.transactionLedgerEvent.aggregate({
        where: {
          stripeCreditPurchaseId: creditPurchase.id,
          kind: TransactionKind.CREDIT_PURCHASE_REFUND,
        },
        _sum: {
          deltaAdvertiserCents: true,
          deltaAdvertiserLockedCents: true,
        },
      });
      const refundedFromAvailable = -(
        refundAgg._sum.deltaAdvertiserCents ?? 0n
      );
      const refundedFromLocked = -(
        refundAgg._sum.deltaAdvertiserLockedCents ?? 0n
      );

      // Locks placed for this purchase that haven't been consumed or unlocked
      const lockAgg = await tx.transactionLedgerEvent.aggregate({
        where: {
          stripeCreditPurchaseId: creditPurchase.id,
          kind: TransactionKind.CREDIT_PURCHASE_REFUND_LOCK,
        },
        _sum: { deltaAdvertiserLockedCents: true },
      });
      const totalLocked = lockAgg._sum.deltaAdvertiserLockedCents ?? 0n;

      const unlockAgg = await tx.transactionLedgerEvent.aggregate({
        where: {
          stripeCreditPurchaseId: creditPurchase.id,
          kind: TransactionKind.CREDIT_PURCHASE_REFUND_UNLOCK,
        },
        _sum: { deltaAdvertiserLockedCents: true },
      });
      const totalUnlocked = -(unlockAgg._sum.deltaAdvertiserLockedCents ?? 0n);

      const pendingLocked = totalLocked - refundedFromLocked - totalUnlocked;

      const totalRefunded =
        refundedFromAvailable + refundedFromLocked + pendingLocked;
      const remainingRefundable = creditPurchase.amountCents - totalRefunded;

      const maxRefundable =
        availableBudget < remainingRefundable
          ? availableBudget
          : remainingRefundable;

      if (maxRefundable <= 0n) {
        throw createCustomError(4976, "No refundable amount available", 400);
      }
      if (BigInt(amountCents) > maxRefundable) {
        throw createCustomError(
          4976,
          `Amount exceeds max refundable of ${maxRefundable} cents`,
          400,
        );
      }

      const externalRef = `admin_refund_lock:${creditPurchase.id}:${new Date().toISOString()}`;

      const { event, created } = await lockBudgetForCreditPurchaseRefund(tx, {
        advertiserId,
        lockCents: amountCents,
        stripeCreditPurchaseId: creditPurchase.id,
        externalRef,
        meta: {
          creditPurchaseUid,
          adminId,
          adminUid,
          ...(reason ? { reason } : {}),
        },
      });
      if (!created) {
        throw createCustomError(4977, "Duplicate refund request", 409);
      }

      const updated = await tx.advertiser.findUnique({
        where: { id: advertiserId },
        select: {
          sensitiveData: { select: { availableBudgetUsdCents: true } },
        },
      });
      const newAvailableBudget =
        updated?.sensitiveData?.availableBudgetUsdCents ?? 0n;

      // Post-lock re-check: the pre-lock balance read is read-then-write, so a
      // concurrent movement on the same budget (a share settlement, a
      // double-submitted refund) can slip between the check and the lock. The
      // lock's decrement is atomic, so the loser of the race sees the combined
      // result here and rolls the whole transaction (lock included) back.
      if (newAvailableBudget < 0n) {
        throw createCustomError(
          4978,
          "Concurrent budget movement made the refund unfundable, please retry",
          409,
        );
      }

      return {
        lockEventId: event.id,
        externalRef,
        maxRefundableCents: Number(maxRefundable),
        newAvailableBudgetCents: Number(newAvailableBudget),
      };
    });

    // Issue the Stripe refund (outside the transaction)
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: creditPurchase.stripePaymentIntentId,
        amount: amountCents,
      });
    } catch (err: any) {
      // Only a DEFINITIVE Stripe rejection (received, understood, refused —
      // the refund was certainly not created) may release the lock. An
      // AMBIGUOUS failure (timeout / 5xx / connection drop) can mean the
      // refund actually went through: the refund.succeeded webhook then
      // CONSUMES this very lock to book the refund, so unlocking here too
      // would restore available budget the advertiser also got back on the
      // card — a double credit paid by the platform (E021). Keep the lock and
      // page a human; the webhook (or manual reconciliation) resolves it.
      if (!isDefinitiveStripeRejection(err)) {
        throw createCustomError(
          4981,
          `Stripe refund outcome unknown: ${err?.message ?? "unknown error"}. ${amountCents} cents remain locked for credit purchase ${creditPurchaseUid} until the refund webhook lands or the ledger is reconciled manually.`,
          {
            status: 502,
            cause: err,
            notify: true,
            notifyKey: `admin_refund_ambiguous:${creditPurchase.id}`,
          },
        );
      }

      let unlockedCents = 0n;
      try {
        await prisma.$transaction(async (tx) => {
          const unlockRef = `admin_refund_unlock:${creditPurchase.id}:${lockResult.externalRef}`;
          // The wrapper caps the unlock at the purchase's still-pending lock,
          // so even a mis-classified race with the webhook can't double-release.
          const unlock = await unlockBudgetForFailedCreditPurchaseRefund(tx, {
            advertiserId,
            unlockCents: amountCents,
            stripeCreditPurchaseId: creditPurchase.id,
            externalRef: unlockRef,
            meta: {
              creditPurchaseUid,
              adminId,
              adminUid,
              stripeError: err?.message ?? "unknown",
              lockEventId: lockResult.lockEventId,
            },
          });
          unlockedCents = unlock.unlockedCents;
        });
      } catch (unlockErr) {
        // Funds are stuck locked with no owner — a human must act.
        throw createCustomError(
          4979,
          `Stripe refund failed AND unlock failed — ${amountCents} cents stuck locked for credit purchase ${creditPurchaseUid}`,
          {
            status: 502,
            cause: unlockErr,
            notify: true,
            notifyKey: `admin_refund_unlock_failed:${creditPurchase.id}`,
          },
        );
      }

      throw createCustomError(
        4979,
        unlockedCents > 0n
          ? `Stripe refund failed: ${err?.message ?? "unknown error"}. Funds have been unlocked.`
          : `Stripe refund failed: ${err?.message ?? "unknown error"}. The refund lock was already consumed (likely by the refund webhook) — nothing was unlocked.`,
        { status: 502, cause: err },
      );
    }

    res.status(200).json({
      message: "Refund initiated successfully",
      creditPurchaseUid,
      refundedCents: amountCents,
      maxRefundableCents: lockResult.maxRefundableCents,
      newAvailableBudgetCents: lockResult.newAvailableBudgetCents,
      stripeRefundId: stripeRefund.id,
    } satisfies AdminRefundCreditPurchaseResponse);
  },
);
