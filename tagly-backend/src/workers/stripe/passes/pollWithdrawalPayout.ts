import Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { envVariables } from "../../../environment/envVariables.js";
import { handlePayoutPaid } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutPaid.js";
import { handlePayoutFailed } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutFailed.js";
import { handlePayoutCanceled } from "../../../utils/money/stripe/webhookHandlers/connect/handlePayoutCanceled.js";
import { sendPayoutRetriesExhaustedAlert } from "../../../utils/money/withdrawals/sendPayoutRetriesExhaustedAlert.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import type {
  ConnectPayoutResult,
  PendingCustomerNotification,
} from "../../../utils/money/stripe/webhookHandlers/types.js";
import type { StuckWithdrawal } from "../helpers/findStuckWithdrawals.js";

async function queueNote(note: PendingCustomerNotification) {
  if (!note) return;
  await queueNotificationJobs({
    eventSlug: note.eventSlug,
    payload: note.payload,
    dedupeKey: note.dedupeKey,
    customerIds: note.customerIds,
  });
}

/**
 * Poll a PENDING withdrawal's IN_FLIGHT payout and replay the matching webhook
 * handler if it has resolved (missed-webhook backstop). A synthetic event with a
 * deterministic id is fed to the same `handlePayout*` used by the live webhook, so
 * dedupe keys stay stable across re-polls (W-5: paid / failed / canceled).
 */
export async function pollWithdrawalPayout(w: StuckWithdrawal) {
  if (!w.stripePayoutId || !w.stripeAccountId) return;

  const payout = await stripe.payouts.retrieve(w.stripePayoutId, {
    stripeAccount: w.stripeAccountId,
  });

  // Only act on terminal states; pending / in_transit are still legitimately on
  // their way and get re-polled next time.
  if (
    payout.status !== "paid" &&
    payout.status !== "failed" &&
    payout.status !== "canceled"
  ) {
    return;
  }

  const type =
    payout.status === "paid"
      ? "payout.paid"
      : payout.status === "failed"
        ? "payout.failed"
        : "payout.canceled";

  const event = {
    id: `reconcile_${type.replace(".", "_")}_${payout.id}`,
    object: "event",
    type,
    account: w.stripeAccountId,
    api_version: envVariables.STRIPE_API_VERSION_SERVER,
    created: Math.floor(Date.now() / 1000),
    data: { object: payout },
    livemode: payout.livemode,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  } as unknown as Stripe.Event;

  const result: ConnectPayoutResult = await prisma.$transaction(
    async (tx) => {
      if (payout.status === "paid") {
        return {
          note: await handlePayoutPaid(tx, event),
          exhausted: false,
          withdrawalUid: null,
        };
      }
      return payout.status === "failed"
        ? handlePayoutFailed(tx, event)
        : handlePayoutCanceled(tx, event);
    },
    { maxWait: 5000, timeout: 25000 },
  );

  await queueNote(result.note);
  if (result.exhausted && result.withdrawalUid) {
    sendPayoutRetriesExhaustedAlert(result.withdrawalUid);
  }
}
