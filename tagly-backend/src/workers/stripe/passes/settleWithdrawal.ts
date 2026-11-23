import prisma from "../../../prisma/prisma.js";
import { createWithdrawalFromLocked } from "../../../utils/money/ledger/events/withdrawals/createWithdrawalFromLocked.js";
import { recordSettled } from "../../../utils/money/withdrawals/withdrawalTransitions.js";
import { toWireWithdrawalPurpose } from "../../../utils/money/withdrawals/withdrawalPurpose.js";
import type { WorkerLogger } from "../../runtime/workerLogger.js";
import type { StuckWithdrawal } from "../helpers/findStuckWithdrawals.js";

/**
 * W-3b — a transfer landed but the WITHDRAWAL settle event never committed. Replay
 * it (idempotent on the transfer id) + `recordSettled`, atomically, so the lock is
 * finally consumed and the row becomes eligible for payout creation.
 */
export async function settleWithdrawal(w: StuckWithdrawal, log: WorkerLogger) {
  if (!w.stripeTransferId) return; // not eligible (defensive)
  if (!w.customerId) {
    // A settle needs the customer's locked balance; a swept (customer-deleted)
    // row can't be settled. This shouldn't occur — deleteCustomer only removes
    // the customer once the sweep has settled — so surface it loudly.
    log.error("withdrawal needs settle but has no customer; cannot recover", {
      withdrawalUid: w.uid,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await createWithdrawalFromLocked(tx, {
      customerId: w.customerId as number,
      amountCents: w.amountCents,
      transferId: w.stripeTransferId as string,
      stripeWithdrawalId: w.id,
      meta: {
        withdrawalId: w.id,
        withdrawalUid: w.uid,
        purpose: toWireWithdrawalPurpose(w.purpose),
        recoveredBy: "worker_needs_settle",
      },
    });
    await recordSettled(tx, { withdrawalId: w.id });
  });
}
