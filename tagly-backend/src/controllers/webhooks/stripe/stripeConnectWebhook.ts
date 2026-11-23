import type { RequestHandler } from "express";
import Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import {
  createCustomError,
  isCustomError,
} from "../../../utils/core/errors/createCustomError.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { envVariables } from "../../../environment/envVariables.js";
import { handlePayoutPaid } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutPaid.js";
import { handlePayoutFailed } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutFailed.js";
import { handlePayoutCanceled } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutCanceled.js";
import { handleConnectAccountUpdated } from "../../../utils/money/stripe/webhookHandlers/connect/handleConnectAccountUpdated.js";
import { handleExternalAccountChanged } from "../../../utils/money/stripe/webhookHandlers/connect/handleExternalAccountChanged.js";
import {
  ConnectPayoutResult,
  PendingCustomerNotification,
} from "../../../utils/money/stripe/webhookHandlers/types.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import { sendPayoutRetriesExhaustedAlert } from "../../../utils/money/withdrawals/sendPayoutRetriesExhaustedAlert.js";

// Try to enqueue notification outside the tx (best-effort)
async function maybeQueueOutsideTx(note: PendingCustomerNotification) {
  if (!note) {
    return;
  }

  await queueNotificationJobs({
    eventSlug: note.eventSlug,
    payload: note.payload,
    dedupeKey: note.dedupeKey,
    customerIds: note.customerIds,
  });
}

const EMPTY_RESULT: ConnectPayoutResult = {
  note: null,
  exhausted: false,
  withdrawalUid: null,
};

// All Connect business logic in a single tx. Normalized to a ConnectPayoutResult
// so the caller can, after commit, both queue the customer notification and send
// the D4 ops alert on a retry-exhaustion edge.
async function handleStripeConnectEventInTransaction(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<ConnectPayoutResult> {
  const type = event.type;

  if (type === "account.updated") {
    return { ...EMPTY_RESULT, note: await handleConnectAccountUpdated(tx, event) };
  }

  // bank account added/fixed -> re-arm stuck withdrawals for immediate retry
  // (the fix signal the payouts-enabled edge can't see; covers orphans too)
  if (
    type === "account.external_account.created" ||
    type === "account.external_account.updated"
  ) {
    await handleExternalAccountChanged(tx, event);
    return EMPTY_RESULT;
  }

  // payout succeeded -> balance is in customers bank
  if (type === "payout.paid") {
    return { ...EMPTY_RESULT, note: await handlePayoutPaid(tx, event) };
  }

  // payout failed -> balance stays in customer's connect account
  if (type === "payout.failed") {
    return handlePayoutFailed(tx, event);
  }

  // payout canceled -> money-wise identical to failed (W-5)
  if (type === "payout.canceled") {
    return handlePayoutCanceled(tx, event);
  }

  // Unhandled types: no domain changes, but StripeEvent will still be recorded.
  return EMPTY_RESULT;
}

/**
 * Handles Stripe Connect webhook events for customer payouts.
 *
 * Supported events:
 * - account.updated: Syncs payouts_enabled status to local DB
 * - payout.paid: Marks withdrawal as COMPLETED
 * - payout.failed: Records failure details (status remains PENDING, money in Connect account)
 *
 * Security:
 * - Verifies Stripe signature before processing
 * - Event-level deduplication via StripeEvent table
 * - Idempotent handlers for safe retries
 *
 * Must be mounted with express.raw({ type: "application/json" }) before express.json()
 */
export const stripeConnectWebhook: RequestHandler = asyncHandler(
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
        envVariables.STRIPE_CONNECT_WEBHOOK_SECRET
      );
    } catch {
      throw createCustomError(1311, "bad signature", 400);
    }

    let result: ConnectPayoutResult = EMPTY_RESULT;

    try {
      result = await prisma.$transaction(
        async (tx) => {
          // Atomic event-level dedupe (prevents the parallel-delivery race
          // where two webhook deliveries both pass a pre-tx "seen" check and
          // both run the handler). Mirrors stripePlatformWebhook.ts.
          try {
            await tx.stripeEvent.create({
              data: { eventId: event.id, type: event.type },
            });
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002"
            ) {
              return EMPTY_RESULT;
            }
            throw err;
          }

          // Only run domain logic if we "won" the eventId insert
          return handleStripeConnectEventInTransaction(tx, event);
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

    // Tx committed → DB state is durable. Both side effects below are best-effort.
    await maybeQueueOutsideTx(result.note);
    if (result.exhausted && result.withdrawalUid) {
      sendPayoutRetriesExhaustedAlert(result.withdrawalUid);
    }

    return res.sendStatus(200);
  }
);
