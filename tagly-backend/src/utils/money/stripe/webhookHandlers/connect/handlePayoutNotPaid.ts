import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import type { ConnectPayoutResult } from "../types.js";
import {
  recordPayoutFailed,
  recordPayoutCanceled,
} from "../../../withdrawals/withdrawalTransitions.js";
import { parseWireWithdrawalPurpose } from "../../../withdrawals/withdrawalPurpose.js";

const EMPTY: ConnectPayoutResult = {
  note: null,
  exhausted: false,
  withdrawalUid: null,
};

/**
 * Shared body for `payout.failed` and `payout.canceled` — the two are money-wise
 * identical (funds returned to the Connect balance; W-5), differing only in which
 * transition helper stamps the payout leg.
 *
 * - Accepts **both** purposes (W-2): a sweep payout failure must be annotated too,
 *   even though there's no customer left to notify.
 * - Looks the row up by `metadata.withdrawalUid` (W-10), never the numeric id.
 * - Keeps `status = PENDING` (the money left the platform at transfer time); the
 *   transition owner records `payoutStatus`, annotates the failure, schedules the
 *   retry (D3 backoff), and flips a late-bounced COMPLETED row back to PENDING
 *   (D1). A stale/duplicate event returns `applied: false` → no notification.
 * - Customer notification uses a **per-withdrawal** dedupe key (D3): only the
 *   first failure across all attempts notifies.
 * - `exhausted` is surfaced so the caller can send the D4 ops alert after commit.
 */
export async function handlePayoutNotPaid(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
  kind: "FAILED" | "CANCELED",
): Promise<ConnectPayoutResult> {
  const payout = event.data.object as Stripe.Payout;
  const stripeAccountId = event.account;
  if (!stripeAccountId) return EMPTY;

  const purpose = parseWireWithdrawalPurpose(payout.metadata?.purpose);
  if (!purpose) {
    return EMPTY;
  }

  const withdrawalUid = (payout.metadata?.withdrawalUid ?? "").toString();
  if (!withdrawalUid) return EMPTY;

  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { uid: withdrawalUid },
    select: { id: true, uid: true, customerId: true },
  });
  if (!withdrawal) return EMPTY;

  const failureCode = payout.failure_code ?? null;
  const failureMessage = (payout.failure_message ?? "payout_failed").slice(
    0,
    1024,
  );

  const record = kind === "CANCELED" ? recordPayoutCanceled : recordPayoutFailed;
  const { applied, exhausted } = await record(tx, {
    withdrawalId: withdrawal.id,
    payoutId: payout.id,
    failureCode,
    failureMessage,
  });

  // Stale attempt or duplicate/replay of an already-recorded terminal state.
  if (!applied) return EMPTY;

  // The ops alert fires on the exhaustion edge regardless of purpose — a stranded
  // sweep has no customer but still needs a human.
  const withdrawalUidForAlert = exhausted ? withdrawal.uid : null;

  // Sweeps have no customer to notify.
  if (purpose === "account_deletion_sweep" || !withdrawal.customerId) {
    return { note: null, exhausted, withdrawalUid: withdrawalUidForAlert };
  }

  const customerId = withdrawal.customerId;
  return {
    note: {
      eventSlug: "c.balance.withdrawal-failed",
      payload: {
        customerId,
        payoutId: payout.id,
        withdrawalIds: [withdrawal.id],
        failureCode,
        failureMessage,
      },
      // D3: per-withdrawal (not per-attempt/event) — the DB unique constraint on
      // (target, recipientId, eventSlug, channel, dedupeKey) suppresses every
      // failure after the first for this withdrawal.
      dedupeKey: `withdrawal-payout-failed:${withdrawal.uid}`,
      customerIds: [customerId],
    },
    exhausted,
    withdrawalUid: withdrawalUidForAlert,
  };
}
