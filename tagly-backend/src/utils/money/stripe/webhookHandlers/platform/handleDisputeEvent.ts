import type Stripe from "stripe";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import { refundAdvertiserCreditPurchase } from "../../../ledger/events/creditPurchase/refundAdvertiserCreditPurchase.js";
import { reportError } from "../../../../core/errors/reportError.js";
import { recalcCreditPurchaseRefundStatus } from "./recalcCreditPurchaseRefundStatus.js";

/**
 * Handles `charge.dispute.created` and `charge.dispute.closed` — chargebacks
 * (E066). A cardholder disputing a charge makes Stripe pull the disputed amount
 * plus the dispute fee out of the platform balance immediately; there is no
 * Refund object, so `handleRefundEvent` never sees any of it.
 *
 * Policy (Matej, 2026-08-01 — option "alert on created, book on lost"):
 * - `created` → team alert only (deduped per dispute id). No money movement —
 *   the funds may come back if the dispute is won.
 * - `closed` + `status: lost` → the clawback is final: mirror it into the
 *   ledger through `refundAdvertiserCreditPurchase` (externalRef
 *   `stripe_dispute_{id}`, `enforceBalance: false` so the advertiser's
 *   available budget may go negative — the same uncollectable-receivable model
 *   as Stripe-forced refunds), recalc the purchase's REFUNDED /
 *   PARTIALLY_REFUNDED status, and alert. The dispute FEE is deliberately not
 *   booked against the advertiser — it is a platform cost and surfaces via the
 *   unassigned Stripe balance.
 * - `closed` + any other status (`won`, `warning_closed`, …) → alert only,
 *   closing the loop opened by the `created` alert.
 *
 * A dispute we cannot tie to a purchase (or one on a purchase with no
 * advertiser) is alerted and ACKed rather than thrown: Stripe retries could
 * never make it bookable, and the alert is the designed escalation.
 *
 * No advertiser-facing notification is sent — the disputer is (almost always)
 * the advertiser themselves; this surface is for the team.
 *
 * Both `charge.dispute.*` events are subscribed on the PLATFORM webhook
 * endpoints in staging and production (verified against the Stripe API,
 * 2026-08-07) — this handler is live. They are deliberately absent from the
 * CONNECT endpoints (disputes are a platform-charge concern).
 */
export async function handleDisputeEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<null> {
  const dispute = event.data.object as Stripe.Dispute;

  const disputeAmountCents = dispute.amount ?? 0;
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? null);
  const chargeId =
    typeof dispute.charge === "string"
      ? dispute.charge
      : (dispute.charge?.id ?? null);

  // Resolve the purchase: PI id is canonical (deposit rows have no charge id —
  // see the stripeChargeId gap); fall back to the charge id (PAYG rows carry it).
  let creditPurchase = paymentIntentId
    ? await tx.stripeCreditPurchase.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: {
          id: true,
          uid: true,
          amountCents: true,
          currency: true,
          status: true,
          advertiserId: true,
          stripePaymentIntentId: true,
        },
      })
    : null;
  if (!creditPurchase && chargeId) {
    creditPurchase = await tx.stripeCreditPurchase.findFirst({
      where: { stripeChargeId: chargeId },
      select: {
        id: true,
        uid: true,
        amountCents: true,
        currency: true,
        status: true,
        advertiserId: true,
        stripePaymentIntentId: true,
      },
    });
  }

  const alert = (
    reason: string,
    extraLines: string[],
    notifyKeyPrefix: string,
  ) => {
    reportError(reason, {
      source: "system",
      errorClass: "permanent",
      service: "stripe",
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      disputeAmountCents,
      paymentIntentId,
      chargeId,
      creditPurchaseUid: creditPurchase?.uid ?? null,
      notify: true,
      notifyKey: `${notifyKeyPrefix}:${dispute.id}`,
      notifyLines: [
        `Dispute ${dispute.id} (${dispute.status}) — ${disputeAmountCents} cents, charge ${chargeId ?? "?"}, PI ${paymentIntentId ?? "?"}.`,
        creditPurchase
          ? `Credit purchase ${creditPurchase.uid} (advertiser id ${creditPurchase.advertiserId ?? "NONE"}).`
          : "No StripeCreditPurchase row matches this dispute.",
        ...extraLines,
      ],
    });
  };

  if (event.type === "charge.dispute.created") {
    alert(
      `Chargeback opened: ${disputeAmountCents} cents disputed`,
      [
        "Stripe has already pulled the disputed amount + fee from the platform balance.",
        "No ledger movement yet — it books automatically if the dispute is lost.",
        "Consider responding in the Stripe dashboard before the evidence deadline.",
      ],
      "stripe-dispute-created",
    );
    return null;
  }

  // charge.dispute.closed
  if (dispute.status !== "lost") {
    alert(
      `Chargeback closed (${dispute.status}) — no clawback booked`,
      [
        dispute.status === "won"
          ? "Dispute won: Stripe reinstated the funds. Nothing was booked, nothing to reconcile."
          : "Closed without a loss — no money movement was booked.",
      ],
      "stripe-dispute-closed",
    );
    return null;
  }

  // Lost → the clawback is final. Book it, or alert if it is unbookable.
  if (
    !creditPurchase ||
    !creditPurchase.advertiserId ||
    !creditPurchase.stripePaymentIntentId
  ) {
    alert(
      `Chargeback LOST but unbookable — ledger does not mirror a ${disputeAmountCents}-cent clawback`,
      [
        "The dispute could not be tied to an advertiser credit purchase, so the ledger was NOT debited.",
        "Manual reconciliation required.",
      ],
      "stripe-dispute-unbookable",
    );
    return null;
  }

  if ((dispute.currency?.toLowerCase?.() ?? "") !== creditPurchase.currency) {
    alert(
      `Chargeback LOST but currency mismatch — clawback NOT booked`,
      [
        `Dispute currency ${dispute.currency} vs purchase currency ${creditPurchase.currency}.`,
        "Manual reconciliation required.",
      ],
      "stripe-dispute-currency-mismatch",
    );
    return null;
  }

  if (disputeAmountCents <= 0) {
    return null;
  }

  await refundAdvertiserCreditPurchase(tx, {
    advertiserId: creditPurchase.advertiserId,
    refundCents: disputeAmountCents,
    creditPurchaseUid: creditPurchase.uid,
    stripePaymentIntentId: creditPurchase.stripePaymentIntentId,
    stripeDisputeId: dispute.id,
    stripeCreditPurchaseId: creditPurchase.id,
    enforceBalance: false,
    meta: {
      stripe: {
        disputeId: dispute.id,
        paymentIntentId: creditPurchase.stripePaymentIntentId,
        ...(chargeId ? { chargeId } : {}),
      },
      chargeback: true,
    },
  });

  await recalcCreditPurchaseRefundStatus(tx, {
    id: creditPurchase.id,
    uid: creditPurchase.uid,
    amountCents: creditPurchase.amountCents,
    advertiserId: creditPurchase.advertiserId,
    status: creditPurchase.status,
  });

  alert(
    `Chargeback LOST — ${disputeAmountCents} cents clawed back and booked to the ledger`,
    [
      "The advertiser's budget was debited (negative balance allowed — receivable model).",
      "The dispute fee is a platform cost and is NOT booked against the advertiser.",
    ],
    "stripe-dispute-lost",
  );

  return null;
}
