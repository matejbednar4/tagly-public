import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { createStandardWithdrawalPayoutOrThrow } from "../../../utils/money/withdrawals/createStandardWithdrawalPayoutOrThrow.js";
import { reverseWithdrawalFromTransfer } from "../../../utils/money/ledger/events/withdrawals/reverseWithdrawalFromTransfer.js";
import { parkPayoutRetries } from "../../../utils/money/withdrawals/withdrawalTransitions.js";
import { reportError } from "../../../utils/core/errors/reportError.js";
import { toWireWithdrawalPurpose } from "../../../utils/money/withdrawals/withdrawalPurpose.js";
import { handlePayoutCreateFailure } from "../helpers/handlePayoutCreateFailure.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { StuckWithdrawal } from "../helpers/findStuckWithdrawals.js";

/**
 * W-1 — retry a FAILED/CANCELED payout that's due, under a fresh
 * attempt-numbered idempotency key so Stripe creates a genuinely new payout
 * after the previous one terminally failed. The payout amount/currency are
 * derived inside the shared helper from the transfer's destination payment
 * (W-20 — net minus destination refunds, in the account's own currency), which
 * natively reflects any booked reversal; the ledger-side `amountCents −
 * reversedCents ≤ 0` guard below stays as the cheap first line.
 *
 * W-18 — before computing the retry, sync any transfer reversal that was
 * DEFERRED by `handleTransferReversed` because a payout was IN_FLIGHT at the
 * time. That payout has since terminally resolved (this row is FAILED/CANCELED),
 * so the clawed-back state is now unambiguous: book the deferred customer credit
 * and retry only the un-reversed remainder. Without this sync we'd retry the
 * full amount against a clawed-back Connect balance (`balance_insufficient`
 * loop) and the customer credit would never happen.
 */
export async function retryWithdrawalPayout(
  w: StuckWithdrawal,
  log: WorkerLogger,
) {
  if (!w.stripeAccountId) return; // filtered by the query; type-narrow only
  // A FAILED/CANCELED payout implies the transfer + settle landed; type-narrow.
  if (!w.stripeTransferId) return;

  // W-18 reversal sync — AUXILIARY and deliberately non-blocking: it only
  // matters in the manual-clawback edge case, so a failure here (transient
  // Stripe error, or a persistently unretrievable transfer id) must never
  // stall the actual retry or throw the row into an every-30s requery loop.
  // Falling through with the stored `reversedCents` is money-safe: a stale
  // value can only make the payout amount wrong in a direction Stripe rejects
  // (`balance_insufficient`, a definitive rejection), which the W-19 handler
  // then bounds via backoff → park.
  let reversedCents = w.reversedCents;
  if (w.stripeTransferId) {
    try {
      const transfer = await stripe.transfers.retrieve(w.stripeTransferId);
      const totalReversed = BigInt(transfer.amount_reversed ?? 0);

      if (totalReversed > reversedCents) {
        if (!w.customerId) {
          // Orphaned sweep (customer deleted): there is no balance to credit. Any
          // un-reversed remainder still belongs in their bank, so pay that out;
          // if fully clawed back there is nothing automation can do — park the
          // retries and hand it to a human (D4).
          if (totalReversed >= w.amountCents) {
            log.error("orphaned sweep fully clawed back; parking retries", {
              withdrawalUid: w.uid,
            });
            await parkPayoutRetries(prisma, { withdrawalId: w.id });
            reportError(
              `Orphaned sweep withdrawal ${w.uid} had its transfer fully reversed after the customer was deleted`,
              {
                source: "system",
                errorClass: "permanent",
                service: "stripe",
                withdrawalUid: w.uid,
                notify: true,
                notifyKey: `orphaned-sweep-reversed:${w.uid}`,
                notifyLines: [
                  "The funds are back on the platform with no customer balance to credit, and automatic payout retries have been parked.",
                  "Manual reconciliation required.",
                ],
              },
            );
            return;
          }
          reversedCents = totalReversed; // pay the remainder; the credit is impossible
        } else {
          // Book the deferred credit (idempotent + delta-based; marks the row
          // REVERSED when fully reversed and maintains reversedCents).
          const customerId = w.customerId;
          await prisma.$transaction(async (tx) => {
            await reverseWithdrawalFromTransfer(tx, {
              customerId,
              stripeWithdrawalId: w.id,
              transferId: w.stripeTransferId as string,
              totalReversedCents: totalReversed,
              meta: { recoveredBy: "worker_retry_reversal_sync" },
            });
          });
          if (totalReversed >= w.amountCents) return; // fully reversed → row is now REVERSED
          reversedCents = totalReversed;
        }
      }
    } catch (err) {
      log.warn("W-18 reversal sync failed; proceeding with stored reversedCents", {
        withdrawalUid: w.uid,
        err,
      });
    }
  }

  const amountCents = Number((w.amountCents - reversedCents).toString());
  if (amountCents <= 0) {
    // Defensive (a full reversal marks the row REVERSED before reaching here):
    // nothing to pay and nothing this pass can ever change — park + alert
    // instead of re-querying the same row every 30s forever.
    log.error(
      "nothing left to pay out after reversal but row is not REVERSED; parking retries",
      { withdrawalUid: w.uid },
    );
    await parkPayoutRetries(prisma, { withdrawalId: w.id });
    reportError(
      `Withdrawal ${w.uid} has reversedCents ≥ amountCents but its status is not REVERSED`,
      {
        source: "system",
        errorClass: "permanent",
        service: "stripe",
        withdrawalUid: w.uid,
        notify: true,
        notifyKey: `inconsistent-reversal-state:${w.uid}`,
        notifyLines: [
          "Automatic payout retries have been parked. Manual ledger reconciliation required.",
        ],
      },
    );
    return;
  }

  try {
    await createStandardWithdrawalPayoutOrThrow({
      stripeWithdrawalId: w.id,
      withdrawalUid: w.uid,
      stripeAccountId: w.stripeAccountId,
      stripeTransferId: w.stripeTransferId,
      purpose: toWireWithdrawalPurpose(w.purpose),
      attemptKey: String(w.payoutAttempts + 1),
    });
  } catch (err) {
    // W-19: a thrown create must still advance the schedule (backoff / park),
    // otherwise this row stays due and re-enters the pass every 30s.
    await handlePayoutCreateFailure(w, err, log);
  }
}
