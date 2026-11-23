import Stripe from "stripe";
import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { unlockBalanceForFailedWithdrawal } from "../../../utils/money/ledger/events/withdrawals/unlockBalanceForFailedWithdrawal.js";
import {
  recordTransferSucceeded,
  recordTransferFailed,
} from "../../../utils/money/withdrawals/withdrawalTransitions.js";
import {
  isDefinitiveStripeRejection,
  stripeErrorFailureFields,
} from "../../../utils/money/stripe/stripeErrorClassification.js";
import { reportError } from "../../../utils/core/errors/reportError.js";
import { toWireWithdrawalPurpose } from "../../../utils/money/withdrawals/withdrawalPurpose.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { StuckWithdrawal } from "../helpers/findStuckWithdrawals.js";

/**
 * W-3a / W-16 — resolve a PENDING withdrawal that has no transfer id. List the
 * connected account's recent transfers and match on `metadata.withdrawalUid`
 * (D5): **found → adopt** the transfer id (an ambiguous error / lost persist did
 * create it); **not found → create** the transfer under the original deterministic
 * idempotency key (the balance is still locked, the intent still valid — and if
 * the transfer actually does exist Stripe returns it rather than double-paying).
 */
export async function resolveMissingTransfer(
  w: StuckWithdrawal,
  log: WorkerLogger,
) {
  if (!w.stripeAccountId) {
    // Impossible by construction (the orchestrator can't create a row without a
    // connected account) — but if it ever exists, no transfer can exist for it
    // either (there was no destination to send one to), so unlocking + failing
    // terminally is safe and stops the row from cycling this pass forever.
    await failMissingTransferDefinitively(
      w,
      new Error("row has no stripeAccountId; no transfer can exist for it"),
      log,
    );
    return;
  }

  const purpose = toWireWithdrawalPurpose(w.purpose);
  const createdSec = Math.floor(w.createdAt.getTime() / 1000);
  const gteSec = createdSec - Math.floor(T.transferAdoptLookbackMs / 1000);

  const list = await stripe.transfers.list({
    destination: w.stripeAccountId,
    created: { gte: gteSec },
    limit: T.transferAdoptListLimit,
  });
  const match = list.data.find(
    (t) => (t.metadata?.withdrawalUid ?? "") === w.uid,
  );

  if (match) {
    await recordTransferSucceeded(prisma, {
      withdrawalId: w.id,
      transferId: match.id,
    });
    return;
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: Number(w.amountCents.toString()),
        currency: w.currency,
        destination: w.stripeAccountId,
        // Only the uid + purpose go to Stripe — internal numeric DB ids are never
        // leaked to (or read back from) Stripe (W-10). Mirrors the orchestrator's
        // transfer metadata so an adopted transfer is indistinguishable from an
        // inline-created one.
        metadata: {
          withdrawalUid: w.uid,
          purpose,
        },
      },
      { idempotencyKey: `withdraw:${w.uid}:transfer:${purpose}:v1` },
    );
  } catch (err) {
    // W-17: same money-safety split as the orchestrator's catch (shared
    // classification). Ambiguous → rethrow so runPass logs it and the next tick
    // re-lists (the transfer may still have been created). Definitive → Stripe
    // refused the request, nothing left the platform, and no future tick will
    // fare better — terminally fail the row and release the lock instead of
    // looping every 30s with the customer's balance stuck.
    if (!isDefinitiveStripeRejection(err)) throw err;
    await failMissingTransferDefinitively(w, err, log);
    return;
  }

  await recordTransferSucceeded(prisma, {
    withdrawalId: w.id,
    transferId: transfer.id,
  });
}

/**
 * W-17 terminal path for the missing-transfer pass: Stripe DEFINITIVELY refused
 * the (re)create, so no transfer exists and nothing ever left the platform —
 * release the lock and mark the row FAILED, exactly like the orchestrator's
 * definitive catch. The two defensive branches (customer gone / lock event
 * missing) are impossible by construction — `deleteCustomer` can't delete while
 * a lock is outstanding, and the row + lock are created atomically — so if one
 * ever fires we mark the row FAILED (terminal, stops the loop) WITHOUT moving
 * money and alert the team for manual ledger reconciliation.
 */
async function failMissingTransferDefinitively(
  w: StuckWithdrawal,
  err: unknown,
  log: WorkerLogger,
) {
  const { failureCode, failureMessage } = stripeErrorFailureFields(
    err,
    "stripe_transfer_failed",
  );

  const terminateWithoutUnlock = async (why: string) => {
    log.error(
      "transfer definitively rejected but cannot restore lock; marking FAILED without touching balances",
      { withdrawalUid: w.uid, why, failureCode: failureCode ?? "unknown" },
    );
    await recordTransferFailed(prisma, {
      withdrawalId: w.id,
      failureCode,
      failureMessage,
    });
    reportError(
      `Withdrawal ${w.uid}'s transfer was definitively rejected by Stripe (${failureCode ?? "unknown code"}), but ${why}`,
      {
        source: "system",
        errorClass: "permanent",
        service: "stripe",
        withdrawalUid: w.uid,
        why,
        failureCode: failureCode ?? "unknown",
        notify: true,
        notifyKey: `inconsistent-terminal-failure:${w.uid}`,
        notifyLines: [
          "The row was marked FAILED without releasing any lock. Manual ledger reconciliation required.",
        ],
      },
    );
  };

  if (!w.customerId) {
    await terminateWithoutUnlock(
      "the customer row is gone (no balance to restore the lock to)",
    );
    return;
  }

  const lockEvent = await prisma.transactionLedgerEvent.findFirst({
    where: { kind: "WITHDRAWAL_LOCK", stripeWithdrawalId: w.id },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!lockEvent) {
    await terminateWithoutUnlock(
      "no WITHDRAWAL_LOCK ledger event exists for it",
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    await unlockBalanceForFailedWithdrawal(tx, {
      customerId: w.customerId as number,
      amountCents: w.amountCents,
      withdrawalUid: w.uid,
      reason: "stripe_transfer_failed",
      lockLedgerEventId: lockEvent.id,
      stripeWithdrawalId: w.id,
    });
    await recordTransferFailed(tx, {
      withdrawalId: w.id,
      failureCode,
      failureMessage,
    });
  });

  log.info("transfer definitively rejected; lock released, row FAILED", {
    withdrawalUid: w.uid,
    failureCode: failureCode ?? "unknown",
  });
}
