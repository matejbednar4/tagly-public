import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import { PendingCustomerNotification } from "../types.js";
import { recordPayoutPaid } from "../../../withdrawals/withdrawalTransitions.js";
import { parseWireWithdrawalPurpose } from "../../../withdrawals/withdrawalPurpose.js";

export async function handlePayoutPaid(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<PendingCustomerNotification> {
  const payout = event.data.object as Stripe.Payout;
  const stripeAccountId = event.account;

  if (!stripeAccountId) {
    return null;
  }

  // Only handle payouts that belong to Tagly withdrawal flows (the Connect
  // webhook sees every payout on every connected account, including ones we
  // didn't create). Both customer-initiated withdrawals and account-deletion
  // sweeps mark the withdrawal row COMPLETED; only the customer-initiated
  // variant notifies (the customer no longer exists for sweeps).
  const purpose = parseWireWithdrawalPurpose(payout.metadata?.purpose);
  if (!purpose) {
    return null;
  }

  // W-10: identify the row by its uid (Stripe only ever consumes uids), not the
  // numeric DB id also carried in metadata.
  const withdrawalUid = (payout.metadata?.withdrawalUid ?? "").toString();
  if (!withdrawalUid) {
    // malformed metadata; nothing safe to do
    return null;
  }

  // Look up the specific withdrawal (for the notification payload).
  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { uid: withdrawalUid },
    select: {
      id: true,
      customerId: true,
      amountCents: true,
      currency: true,
    },
  });

  if (!withdrawal) {
    return null;
  }

  const customerId = withdrawal.customerId;

  // Transition through the single owner: marks COMPLETED / payoutStatus PAID and
  // clears failure fields, but only when the row is still PENDING and the payout
  // is the row's current attempt (stale-attempt guard). A stale/duplicate event
  // returns applied:false → we suppress the notification.
  const { applied } = await recordPayoutPaid(tx, {
    withdrawalId: withdrawal.id,
    payoutId: payout.id,
  });
  if (!applied) return null;

  // Account-deletion sweeps have no customer to notify.
  if (purpose === "account_deletion_sweep") return null;

  if (!customerId) return null;

  return {
    eventSlug: "c.balance.withdrawal-completed",
    payload: {
      customerId,
      payoutId: payout.id,
      currency: withdrawal.currency,
      totalAmountCents: withdrawal.amountCents.toString(),
      withdrawalIds: [withdrawal.id],
    },
    dedupeKey: `withdrawal-completed:payout:${payout.id}:${customerId}:${event.id}`,
    customerIds: [customerId],
  };
}
