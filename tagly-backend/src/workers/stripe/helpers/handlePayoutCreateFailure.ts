import prisma from "../../../prisma/prisma.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { stripeErrorFailureFields } from "../../../utils/money/stripe/stripeErrorClassification.js";
import {
  isDefinitivePayoutCreateFailure,
  getPayoutFundsAvailableAt,
} from "../../../utils/money/withdrawals/createStandardWithdrawalPayoutOrThrow.js";
import {
  recordPayoutCreateFailed,
  recordPayoutCreateDeferred,
} from "../../../utils/money/withdrawals/withdrawalTransitions.js";
import { sendPayoutRetriesExhaustedAlert } from "../../../utils/money/withdrawals/sendPayoutRetriesExhaustedAlert.js";
import { reportError } from "../../../utils/core/errors/reportError.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { StuckWithdrawal } from "./findStuckWithdrawals.js";

/**
 * W-19/W-21 — shared handling for a thrown `payouts.create` (needs-payout +
 * retry passes): classify and record so the row always moves forward.
 *
 * Checked in order:
 *  1. **Deferred (W-21)** — the funds are still `pending` on the connected
 *     account (typed 1723 from the payout util's gate): schedule the retry
 *     against Stripe's own `available_on`, consuming NO attempt and rotating
 *     NO key. Not a failure — logged info, never reported. A row deferring
 *     past `payoutFundsAvailabilityAlertAfterMs` escalates to the team
 *     (deduped) so attempt-free deferral can't become silent stuck money (D4).
 *  2. **Definitive** (incl. the payout util's own `{ permanent: true }`
 *     derivation throws — no payout can exist) → counts an attempt (rotates
 *     the next idempotency key) + backoff + persists the failure code, parking
 *     + D4 ops alert at the cap.
 *  3. **Ambiguous** (payout may exist, e.g. the DB write after a successful
 *     create failed) → short same-key recheck; the replay then returns the
 *     created payout (adopted by `recordPayoutCreated`) or re-executes.
 *
 * Never rethrows — the schedule update IS the retry mechanism.
 */
export async function handlePayoutCreateFailure(
  w: StuckWithdrawal,
  err: unknown,
  log: WorkerLogger,
) {
  const fundsAvailableAt = getPayoutFundsAvailableAt(err);
  if (fundsAvailableAt) {
    const { retryAt } = await recordPayoutCreateDeferred(prisma, {
      withdrawalId: w.id,
      fundsAvailableAt,
    });
    log.info("payout deferred until transferred funds become available (W-21)", {
      withdrawalUid: w.uid,
      fundsAvailableAt: fundsAvailableAt.toISOString(),
      retryAt: retryAt.toISOString(),
    });

    // Horizon alert: deferral is attempt-free, so a pathological account
    // (funds that never release) would otherwise wait silently forever. The
    // 6h notify dedupe collapses the hourly rechecks to a few emails a day —
    // deliberate nagging: money stuck this long is a human's job (D4).
    if (Date.now() - w.createdAt.getTime() > T.payoutFundsAvailabilityAlertAfterMs) {
      reportError(
        `Withdrawal ${w.uid} has been waiting on funds availability for over 14 days`,
        {
          source: "system",
          errorClass: "permanent",
          service: "stripe",
          withdrawalUid: w.uid,
          notify: true,
          notifyKey: `payout-funds-availability-horizon:${w.uid}`,
          notifyLines: [
            `The transferred funds on the connected account still report \`pending\` (Stripe available_on: ${fundsAvailableAt.toISOString()}), so no payout attempt has been made — the W-21 deferral keeps rescheduling.`,
            "Check the connected account's balance and the transfer's destination payment in Stripe; this usually means Stripe is holding the funds (review/risk) and needs a support ticket.",
          ],
        },
      );
    }
    return;
  }

  const definitive = isDefinitivePayoutCreateFailure(err);
  const { failureCode, failureMessage } = stripeErrorFailureFields(
    err,
    "payout_create_failed",
  );

  const { exhausted } = await recordPayoutCreateFailed(prisma, {
    withdrawalId: w.id,
    definitive,
    failureCode,
    failureMessage,
  });

  log.warn("payout create failed", {
    withdrawalUid: w.uid,
    definitive,
    failureCode: failureCode ?? "unknown",
    outcome: exhausted ? "attempts exhausted — parked" : "rescheduled",
  });

  if (exhausted) {
    sendPayoutRetriesExhaustedAlert(w.uid);
  }
}
