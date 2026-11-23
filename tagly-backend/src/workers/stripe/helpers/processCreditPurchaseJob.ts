import Stripe from "stripe";
import { StripeCreditPurchaseJob } from "./findStripeJobs.js";
import { stripe } from "../../../utils/clients/stripe.js";
import prisma from "../../../prisma/prisma.js";
import { handlePaymentIntentSucceeded } from "../../../utils/money/stripe/webhookHandlers/platform/handlePaymentIntentSucceeded.js";
import { handlePaymentIntentFailed } from "../../../utils/money/stripe/webhookHandlers/platform/handlePaymentIntentFailed.js";
import { envVariables } from "../../../environment/envVariables.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import type { PendingAdvertiserNotification } from "../../../utils/money/stripe/webhookHandlers/types.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import { jitter } from "../../helpers/jitter.js";

/**
 * Retrieves or hydrates the PaymentIntent ID for a credit purchase job.
 *
 * For Checkout Session flow, the StripeCreditPurchase may have been created
 * before the PaymentIntent existed. This function fetches the Checkout Session
 * to extract the PI ID and persists it for future lookups.
 */
async function getOrHydratePaymentIntentId(
  job: StripeCreditPurchaseJob,
  log: WorkerLogger,
) {
  if (job.stripePaymentIntentId) {
    return {
      paymentIntentId: job.stripePaymentIntentId,
      session: null as Stripe.Checkout.Session | null,
    };
  }

  if (!job.stripeCheckoutSessionId) {
    return {
      paymentIntentId: null as string | null,
      session: null as Stripe.Checkout.Session | null,
    };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(
      job.stripeCheckoutSessionId,
      {
        expand: ["payment_intent"],
      },
    );
  } catch (err) {
    log.warn("failed to retrieve Checkout Session", {
      checkoutSessionId: job.stripeCheckoutSessionId,
      creditPurchaseId: job.id,
      err,
    });
    return { paymentIntentId: null, session: null };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    return { paymentIntentId: null, session };
  }

  try {
    await prisma.stripeCreditPurchase.update({
      where: { id: job.id },
      data: { stripePaymentIntentId: paymentIntentId },
    });
  } catch (err) {
    log.warn("failed to persist PaymentIntent id", {
      paymentIntentId,
      creditPurchaseId: job.id,
      err,
    });
  }

  return { paymentIntentId, session };
}

/**
 * Processes a single credit purchase job by querying Stripe for terminal status.
 *
 * Flow:
 * 1. Increment attempt counter immediately (ensures backoff even on failure)
 * 2. Get or hydrate PaymentIntent ID from Checkout Session
 * 3. If no PI yet:
 *    - If stale (>24h) and not paid: expire Checkout Session, mark CANCELED
 *    - Otherwise: schedule retry with backoff
 * 4. If PI exists, retrieve from Stripe:
 *    - succeeded: run handlePaymentIntentSucceeded (idempotent ledger creation)
 *    - canceled: run handlePaymentIntentFailed, mark terminal
 *    - other: if stale, attempt to cancel PI; otherwise backoff
 *
 * Reuses the same handlers as the webhook for consistency and idempotency.
 * Creates synthetic Stripe events with reconcile_ prefix for audit trail.
 */
export async function processCreditPurchaseJob(
  job: StripeCreditPurchaseJob,
  log: WorkerLogger,
) {
  const ageMs = Date.now() - job.createdAt.getTime();

  // 1) mark attempt immediately (so even failures back off)
  const attemptRow = await markAttemptStarted(job.id);
  const attempt = attemptRow.reconcileAttempts;

  try {
    const { paymentIntentId, session: expandedSession } =
      await getOrHydratePaymentIntentId(job, log);

    // 2) still no PI (Checkout may still be open)
    if (!paymentIntentId) {
      // If stale enough, expire Checkout session and cancel locally (ONLY if not already paid/complete)
      if (
        ageMs > T.failPendingCreditPurchaseAfterMs &&
        job.stripeCheckoutSessionId
      ) {
        let session = expandedSession;

        if (!session) {
          try {
            session = await stripe.checkout.sessions.retrieve(
              job.stripeCheckoutSessionId,
            );
          } catch (err) {
            log.warn("failed to retrieve stale Checkout Session", {
              checkoutSessionId: job.stripeCheckoutSessionId,
              creditPurchaseId: job.id,
              err,
            });
            // even if this fails, backoff and retry later
            await scheduleNextAttempt(job.id, attempt);
            return;
          }
        }

        const isPaid =
          session?.payment_status === "paid" || session?.status === "complete";

        if (!isPaid) {
          try {
            await stripe.checkout.sessions.expire(job.stripeCheckoutSessionId);
          } catch (err) {
            log.warn("failed to expire stale Checkout Session", {
              checkoutSessionId: job.stripeCheckoutSessionId,
              creditPurchaseId: job.id,
              err,
            });
          }

          await prisma.stripeCreditPurchase.update({
            where: { id: job.id },
            data: { status: "CANCELED", nextReconcileAt: null },
          });
          return;
        }

        // Paid/complete but no PI id surfaced yet → backoff and let it settle
        await scheduleNextAttempt(job.id, attempt);
        return;
      }

      // Not stale yet → backoff retry
      await scheduleNextAttempt(job.id, attempt);
      return;
    }

    // 3) retrieve PI
    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      log.warn("failed to retrieve PaymentIntent", {
        paymentIntentId,
        creditPurchaseId: job.id,
        err,
      });
      await scheduleNextAttempt(job.id, attempt);
      return;
    }

    // 4) terminal handling
    if (pi.status === "succeeded") {
      const note: PendingAdvertiserNotification = await prisma.$transaction(
        async (tx) => {
          const event: Stripe.Event = {
            id: `reconcile_pi_succeeded_${pi.id}`,
            object: "event",
            type: "payment_intent.succeeded",
            api_version: envVariables.STRIPE_API_VERSION_SERVER,
            created: Math.floor(Date.now() / 1000),
            data: { object: pi } as any,
            livemode: pi.livemode,
            pending_webhooks: 0,
            request: { id: null, idempotency_key: null },
          };

          return handlePaymentIntentSucceeded(tx, event);
        },
        { maxWait: 5000, timeout: 25000 },
      );

      // stop future reconciliation
      await clearNextAttempt(job.id);

      if (note) {
        await queueNotificationJobs({
          eventSlug: note.eventSlug,
          payload: note.payload,
          dedupeKey: note.dedupeKey,
          advertiserIds: note.advertiserIds,
        });
      }
      return;
    }

    if (pi.status === "canceled") {
      const note: PendingAdvertiserNotification = await prisma.$transaction(
        async (tx) => {
          const event: Stripe.Event = {
            id: `reconcile_pi_canceled_${pi.id}`,
            object: "event",
            type: "payment_intent.canceled",
            api_version: envVariables.STRIPE_API_VERSION_SERVER,
            created: Math.floor(Date.now() / 1000),
            data: { object: pi } as any,
            livemode: pi.livemode,
            pending_webhooks: 0,
            request: { id: null, idempotency_key: null },
          };

          return handlePaymentIntentFailed(tx, event);
        },
        { maxWait: 5000, timeout: 25000 },
      );

      await clearNextAttempt(job.id);

      if (note) {
        await queueNotificationJobs({
          eventSlug: note.eventSlug,
          payload: note.payload,
          dedupeKey: note.dedupeKey,
          advertiserIds: note.advertiserIds,
        });
      }
      return;
    }

    // 5) non-terminal PI states
    if (ageMs > T.failPendingCreditPurchaseAfterMs) {
      // best-effort cancel; if cancel works, next run will pick up canceled state
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (err) {
        log.warn("failed to cancel stale PaymentIntent", {
          paymentIntentId,
          creditPurchaseId: job.id,
          err,
        });
      }

      // backoff one last time (or you can set a longer delay here)
      await scheduleNextAttempt(job.id, attempt);
      return;
    }

    // normal backoff retry
    await scheduleNextAttempt(job.id, attempt);
    return;
  } catch (err) {
    // unexpected errors: backoff too
    await scheduleNextAttempt(job.id, attempt).catch(() => {});
    throw err;
  }
}

/** Computes next retry delay with exponential backoff and jitter. */
function computeNextDelayMs(attempt: number) {
  // attempt is already incremented (1, 2, 3...)
  const exp = Math.min(
    T.reconcileMaxDelayMs,
    T.reconcileBaseDelayMs *
      Math.pow(2, Math.min(attempt - 1, T.reconcileMaxExpSteps)),
  );

  // +/- jitter (shared helper) to prevent thundering herd
  return Math.max(
    T.reconcileBaseDelayMs,
    Math.floor(jitter(exp, T.reconcileJitterRatio)),
  );
}

/** Increments attempt counter and records timestamp. Called at start of processing. */
async function markAttemptStarted(jobId: number) {
  return prisma.stripeCreditPurchase.update({
    where: { id: jobId },
    data: {
      lastReconcileAttemptAt: new Date(),
      reconcileAttempts: { increment: 1 },
      // keep nextReconcileAt as-is for now; we'll set it at the end
    },
    select: { reconcileAttempts: true },
  });
}

/** Schedules next retry attempt with exponential backoff. */
async function scheduleNextAttempt(jobId: number, attempt: number) {
  const delayMs = computeNextDelayMs(attempt);
  await prisma.stripeCreditPurchase.update({
    where: { id: jobId },
    data: { nextReconcileAt: new Date(Date.now() + delayMs) },
  });
}

/** Clears nextReconcileAt after terminal status reached (no more retries needed). */
async function clearNextAttempt(jobId: number) {
  await prisma.stripeCreditPurchase.update({
    where: { id: jobId },
    data: { nextReconcileAt: null },
  });
}
