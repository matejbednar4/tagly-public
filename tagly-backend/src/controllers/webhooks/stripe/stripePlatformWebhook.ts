import type { RequestHandler } from "express";
import type Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import {
  createCustomError,
  isCustomError,
} from "../../../utils/core/errors/createCustomError.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { envVariables } from "../../../environment/envVariables.js";
import { handlePaymentIntentSucceeded } from "../../../utils/money/stripe/webhookHandlers/platform/handlePaymentIntentSucceeded.js";
import { handleSetupIntentSucceeded } from "../../../utils/money/stripe/webhookHandlers/platform/handleSetupIntentSucceeded.js";
import type { PendingAdvertiserNotification } from "../../../utils/money/stripe/webhookHandlers/types.js";
import { handleRefundEvent } from "../../../utils/money/stripe/webhookHandlers/platform/handleRefundEvent.js";
import { handlePaymentIntentFailed } from "../../../utils/money/stripe/webhookHandlers/platform/handlePaymentIntentFailed.js";
import { handleTransferReversed } from "../../../utils/money/stripe/webhookHandlers/platform/handleTransferReversed.js";
import { handleDisputeEvent } from "../../../utils/money/stripe/webhookHandlers/platform/handleDisputeEvent.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";

/**
 * Enqueue notification outside the transaction (best-effort).
 * Notification failures don't affect webhook success.
 */
async function maybeQueueOutsideTx(note: PendingAdvertiserNotification) {
  if (!note) {
    return;
  }

  await queueNotificationJobs({
    eventSlug: note.eventSlug,
    payload: note.payload,
    dedupeKey: note.dedupeKey,
    advertiserIds: note.advertiserIds,
  });
}

/**
 * Central dispatcher: routes Stripe events to appropriate handlers.
 * All business logic runs inside a single transaction for atomicity.
 *
 * Supported events:
 * - payment_intent.succeeded: Credit purchase completed
 * - payment_intent.payment_failed/canceled: Credit purchase failed
 * - refund.created/updated: Credit purchase refunded
 * - charge.dispute.created/closed: Chargeback — alert on open, book on loss
 * - setup_intent.succeeded: Payment method setup completed
 * - transfer.reversed: Customer withdrawal reversed
 */
async function handleStripeEventInTransaction(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<PendingAdvertiserNotification> {
  const type = event.type;

  // credit purchase worked - move money in DB, mark purchase as succeeded
  if (type === "payment_intent.succeeded") {
    return handlePaymentIntentSucceeded(tx, event);
  }

  if (
    type === "payment_intent.payment_failed" ||
    type === "payment_intent.canceled"
  ) {
    return handlePaymentIntentFailed(tx, event);
  }

  // we want to refund the user / user is refunded by stripe
  if (type === "refund.created" || type === "refund.updated") {
    return handleRefundEvent(tx, event);
  }

  // chargeback lifecycle — alert on open, mirror the clawback on loss (E066)
  if (type === "charge.dispute.created" || type === "charge.dispute.closed") {
    return handleDisputeEvent(tx, event);
  }

  // when the user just set up a payment method, set is as default if none set yet (no money movement)
  if (type === "setup_intent.succeeded") {
    await handleSetupIntentSucceeded(tx, event);
    return null;
  }

  // customer withdrawal was forcedly reversed -> money comes back to us -> credit the customer
  if (event.type === "transfer.reversed") {
    await handleTransferReversed(tx, event);
    return null;
  }

  // Unhandled types: we do nothing domain-wise, but we still record StripeEvent
  return null;
}

/**
 * Handles Stripe platform webhooks for credit purchases and payment operations.
 *
 * Flow:
 * 1. Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 * 2. Atomic event deduplication via StripeEvent table (P2002 handling)
 * 3. Routes to appropriate handler based on event type
 * 4. All business logic runs in a transaction (rolled back on failure)
 * 5. Notifications queued outside transaction (best-effort)
 *
 * Stripe will retry failed webhooks, so we throw 500 on processing errors
 * and let the transaction rollback ensure consistency.
 */
export const stripePlatformWebhook: RequestHandler = asyncHandler(
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      throw createCustomError(1310, "missing signature", 400);
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        String(sig),
        envVariables.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      throw createCustomError(1311, "bad signature", 400);
    }

    let note: PendingAdvertiserNotification = null;

    try {
      note = await prisma.$transaction(
        async (tx) => {
          // Atomic event-level dedupe (prevents races + double notifications)
          try {
            await tx.stripeEvent.create({
              data: { eventId: event.id, type: event.type },
            });
          } catch (err: any) {
            // Unique constraint hit => already processed
            if (err?.code === "P2002") {
              return null;
            }
            throw err;
          }

          // Only run domain logic if we "won" the eventId insert
          return handleStripeEventInTransaction(tx, event);
        },
        { maxWait: 5000, timeout: 25000 }
      );
    } catch (err) {
      // If tx fails, StripeEvent insert also rolled back => Stripe will retry.
      // Rethrow CustomErrors INTACT: the handlers' money-integrity throws carry
      // `notify`/`notifyKey` (team alert) and a specific domain code — replacing
      // them with a synthetic 1312 killed every webhook escalation (E031).
      if (isCustomError(err)) {
        throw err;
      }
      throw createCustomError(1312, "webhook handling failed", {
        status: 500,
        cause: err,
      });
    }

    // Best-effort notifications outside tx
    await maybeQueueOutsideTx(note);

    return res.sendStatus(200);
  }
);
