import type Stripe from "stripe";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { reverseWithdrawalFromTransfer } from "../../../ledger/events/withdrawals/reverseWithdrawalFromTransfer.js";
import { parseWireWithdrawalPurpose } from "../../../withdrawals/withdrawalPurpose.js";
import { reportError } from "../../../../core/errors/reportError.js";
import { queueNotificationJobs } from "../../../../queue/queueNotificationJobs.js";

/**
 * Handles transfer.reversed events for withdrawals (both customer withdrawals
 * and account-deletion sweeps).
 *
 * When a platform→connect transfer is reversed (e.g. Stripe clawback), the money
 * comes back to the platform. Whether we credit the customer depends on where the
 * money physically is, which the payout leg tells us (W-7):
 *  - `payoutStatus = PAID` — the money already reached the customer's bank. A
 *    reversal now can't pull it back from the bank; crediting the Tagly balance
 *    would double-pay. This is a serious incident → log loudly, no state change.
 *  - `payoutStatus = IN_FLIGHT` — a payout is mid-flight; we can't yet tell if the
 *    reversal beat it. Don't credit yet; log and wait for the payout to resolve
 *    (`payout.paid`/`failed` reconciles, and a re-fired reversal will re-evaluate).
 *  - `payoutStatus = NONE | FAILED | CANCELED` — the funds sat on the Connect
 *    account (never paid out, or bounced back) and the reversal has pulled them to
 *    the platform → credit the customer's balance via `reverseWithdrawalFromTransfer`.
 *
 * Accepts both purposes: a reversed sweep transfer has no customer to credit
 * (customerId nulled on deletion), but it is logged rather than silently dropped
 * (W-2/WP-3 — never a silent skip on money movement). Non-withdrawal transfers
 * (neither purpose) are not ours and are ignored.
 */
export async function handleTransferReversed(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
) {
  const transfer = event.data.object as Stripe.Transfer;

  const purpose = parseWireWithdrawalPurpose(transfer.metadata?.purpose);
  if (!purpose) {
    return;
  }

  if (!transfer.id) {
    throw createCustomError(1891, "transfer missing id", 400);
  }

  // W-10: identify the row by its uid (Stripe only ever consumes uids), not the
  // numeric DB id also carried in metadata. customerId/withdrawalId come off the
  // resolved row.
  const withdrawalUid = (transfer.metadata?.withdrawalUid ?? "").toString();
  if (!withdrawalUid) {
    // Our own transfer carries no withdrawalUid → can't reconcile the reversal. Alert.
    throw createCustomError(1893, "invalid withdrawalUid in metadata", {
      status: 500,
      notify: true,
      notifyKey: `transfer-bad-withdrawal-uid:${transfer.id}`,
    });
  }

  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { uid: withdrawalUid },
    select: {
      id: true,
      customerId: true,
      currency: true,
      payoutStatus: true,
    },
  });

  if (!withdrawal) {
    // No such withdrawal — metadata was set by us when we created the transfer,
    // so this is either tampered metadata or a row deleted out from under us.
    // Tracked (not notify): usually bot/tamper noise, not a guaranteed incident.
    reportError(
      new Error(
        `transfer.reversed: no withdrawal for uid=${withdrawalUid} transfer=${transfer.id}`,
      ),
      {
        source: "api",
        errorClass: "unexpected",
        service: "stripe-webhook",
        withdrawalUid,
        transferId: transfer.id,
      },
    );
    return;
  }

  const customerId = withdrawal.customerId;
  const stripeWithdrawalId = withdrawal.id;

  if (!customerId) {
    // Swept withdrawal (customer deleted) — there is no one to credit. A reversed
    // sweep transfer means the money is back on the platform with no owner, which
    // ops must reconcile by hand → track AND alert.
    reportError(
      new Error(
        `transfer.reversed: sweep/orphan withdrawal ${withdrawalUid} reversed with no customer to credit (purpose=${purpose}, payoutStatus=${withdrawal.payoutStatus}, transfer=${transfer.id})`,
      ),
      {
        source: "api",
        errorClass: "unexpected",
        service: "stripe-webhook",
        notify: true,
        notifyKey: `transfer-reversed-orphan:${withdrawalUid}`,
        withdrawalUid,
        transferId: transfer.id,
      },
    );
    return;
  }

  // W-7: gate crediting on where the money actually is (the payout leg), NOT on
  // the mere presence of a payout id (which is set the instant a payout is created,
  // long before it succeeds or when it has already bounced back to Connect).
  if (withdrawal.payoutStatus === "PAID") {
    // Money already reached the bank — a reversal now cannot claw it back from the
    // customer, and crediting would double-pay. Serious money-integrity incident →
    // track AND alert loudly; no state change.
    reportError(
      new Error(
        `transfer.reversed: CLAWBACK on PAID withdrawal ${withdrawalUid} (transfer=${transfer.id}) — payout already reached the bank; NOT crediting. Manual reconciliation required.`,
      ),
      {
        source: "api",
        errorClass: "unexpected",
        service: "stripe-webhook",
        notify: true,
        notifyKey: `transfer-reversed-clawback:${withdrawalUid}`,
        withdrawalUid,
        transferId: transfer.id,
      },
    );
    return;
  }

  if (withdrawal.payoutStatus === "IN_FLIGHT") {
    // A payout is mid-flight; we can't yet tell whether the reversal beat it to the
    // bank. Don't credit now — wait for the payout to resolve (webhook/worker); a
    // re-fired reversal (Stripe keeps amount_reversed cumulative) will re-evaluate.
    return;
  }

  // payoutStatus ∈ NONE | FAILED | CANCELED — the funds were on the Connect
  // account and the reversal has pulled them back to the platform. Safe to credit.

  // Currency sanity check. Unconditional — if Stripe's transfer currency
  // doesn't match the recorded withdrawal currency, refuse to credit.
  const transferCurrency = transfer.currency?.toLowerCase?.() ?? "";
  if (transferCurrency !== withdrawal.currency) {
    throw createCustomError(1895, "transfer currency mismatch", {
      status: 500,
      notify: true,
      notifyKey: `transfer-reversed-currency:${withdrawalUid}`,
    });
  }

  if (
    typeof transfer.amount_reversed !== "number" ||
    transfer.amount_reversed <= 0
  ) {
    // nothing reversed yet
    return;
  }

  if (transfer.amount_reversed > transfer.amount) {
    // Stripe-impossible over-reversal — a money-integrity invariant broke. Alert.
    throw createCustomError(
      1894,
      "transfer reversal exceeds original amount",
      {
        status: 409,
        notify: true,
        notifyKey: `transfer-reversal-over-amount:${withdrawalUid}`,
      }
    );
  }

  await reverseWithdrawalFromTransfer(tx, {
    customerId,
    stripeWithdrawalId,
    transferId: transfer.id,
    totalReversedCents: transfer.amount_reversed,
    meta: {
      stripeEventId: event.id,
    },
  });

  // Tell the customer their money is back on their balance — outbox mode
  // (rides `tx`): the queue row commits atomically with the reversal credit,
  // so a rollback can't leave a false notification. The platform dispatcher's
  // post-commit note channel is advertiser-only, hence the in-tx queue here.
  // Dedupe keys on the cumulative reversed amount: a re-fired event with the
  // same amount is absorbed, a further (larger) reversal notifies again.
  await queueNotificationJobs({
    customerIds: [customerId],
    eventSlug: "c.balance.withdrawal-reversed",
    dedupeKey: `withdrawal-reversed-${stripeWithdrawalId}-${transfer.amount_reversed}`,
    tx,
  });
}
