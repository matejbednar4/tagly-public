import prisma from "../../../prisma/prisma.js";
import { createStandardWithdrawalPayoutOrThrow } from "../../../utils/money/withdrawals/createStandardWithdrawalPayoutOrThrow.js";
import { toWireWithdrawalPurpose } from "../../../utils/money/withdrawals/withdrawalPurpose.js";
import { parkPayoutRetries } from "../../../utils/money/withdrawals/withdrawalTransitions.js";
import { reportError } from "../../../utils/core/errors/reportError.js";
import { handlePayoutCreateFailure } from "../helpers/handlePayoutCreateFailure.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { StuckWithdrawal } from "../helpers/findStuckWithdrawals.js";

/**
 * Create the standard payout for a settled PENDING withdrawal whose inline create
 * didn't land. Idempotent via the shared helper's deterministic key; after prior
 * definitive create rejections the key is attempt-numbered (`attempts + 1`) so a
 * rescheduled try is a real request, not a ~24h cached-error replay (W-19).
 *
 * The payout amount/currency are derived inside the shared helper from the
 * transfer's destination payment (W-20 — net minus destination refunds, in the
 * account's own currency), which natively reflects any partial transfer
 * reversal (E033). The ledger-side `amountCents − reversedCents ≤ 0` guard
 * below stays as the cheap first line: a fully-consumed row is parked without
 * spending Stripe calls, mirroring `retryWithdrawalPayout`.
 *
 * A create-call failure routes through `handlePayoutCreateFailure`, so this
 * function never leaves the row's schedule untouched — the pass cannot re-query
 * the same row every 30s on unchanging state.
 */
export async function createMissingWithdrawalPayout(
  w: StuckWithdrawal,
  log: WorkerLogger,
) {
  if (!w.stripeAccountId) return; // filtered by the query; type-narrow only
  // Settled rows always have a transfer id (settle requires it); type-narrow.
  if (!w.stripeTransferId) return;

  const amountCents = Number((w.amountCents - w.reversedCents).toString());
  if (amountCents <= 0) {
    // Defensive (a full reversal marks the row REVERSED before reaching here):
    // nothing to pay and nothing this pass can ever change — park + alert
    // instead of re-querying the same row every 30s forever. Mirrors
    // retryWithdrawalPayout's identical guard.
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
      attemptKey:
        w.payoutAttempts > 0 ? String(w.payoutAttempts + 1) : undefined,
    });
  } catch (err) {
    await handlePayoutCreateFailure(w, err, log);
  }
}
