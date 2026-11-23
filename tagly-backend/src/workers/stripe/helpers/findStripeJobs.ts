import prisma from "../../../prisma/prisma.js";
import { CreditPurchaseStatus } from "../../../generated/prisma/client.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { olderThan } from "../../helpers/olderThan.js";

export type StripeCreditPurchaseJob = {
  id: number;
  uid: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: Date;

  reconcileAttempts: number;
  nextReconcileAt: Date | null;
};

/**
 * Finds PENDING credit purchases that need reconciliation with Stripe.
 *
 * Selection criteria:
 * - Status is PENDING (not yet resolved by webhook)
 * - Created before cutoff (gives webhook time to arrive first)
 * - Due for retry (nextReconcileAt is null or in the past)
 * - Has a PaymentIntent or Checkout Session ID (can query Stripe)
 *
 * Returns jobs ordered by nextReconcileAt (oldest first), limited to batchSize.
 */
export async function findStripeJobs(): Promise<StripeCreditPurchaseJob[]> {
  const now = new Date();
  const creditPurchaseCutoff = olderThan(T.maxPendingCreditPurchaseAgeMs);

  return prisma.stripeCreditPurchase.findMany({
    where: {
      status: CreditPurchaseStatus.PENDING,
      // PAYG_CHARGE rows are settle-path-owned: settlePaygShare's recovery
      // pre-pass books them (it knows the share/attempt context; this worker
      // would churn on them — handlePaymentIntentSucceeded no-ops on
      // purpose !== credit_purchase). They now carry PI ids, so without this
      // filter they would match the query below.
      kind: "CREDIT_PURCHASE",
      createdAt: { lt: creditPurchaseCutoff },

      // only jobs that are due
      OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }],

      // only ones we can reconcile
      AND: [
        {
          OR: [
            { stripePaymentIntentId: { not: null } },
            { stripeCheckoutSessionId: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      uid: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      createdAt: true,
      reconcileAttempts: true,
      nextReconcileAt: true,
    },
    orderBy: [{ nextReconcileAt: "asc" }, { createdAt: "asc" }],
    take: T.batchSize,
  });
}
