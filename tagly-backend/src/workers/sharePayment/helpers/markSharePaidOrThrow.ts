import type { Prisma } from "../../../generated/prisma/client.js";
import {
  isPendingOrValidReport,
  PROCESSING_SHARE_WHERE,
} from "../../../utils/shares/shareAccess.js";

/**
 * Thrown when the PROCESSING → PAID claim finds the share already terminal — a
 * concurrent void (IG disconnect, Meta deletion webhook, account deletion) won
 * the race. The settle tx rolls back, and the worker must NOT treat this as a
 * payment failure: the void owner already handled the terminal status and any
 * lock release, so unlocking (or paying) here would double-release the lock.
 */
export class ShareNotProcessingError extends Error {
  constructor(shareId: number) {
    super(`share ${shareId} is no longer PROCESSING — lost the settle race`);
    this.name = "ShareNotProcessingError";
  }
}

/**
 * Atomically claims the PROCESSING → PAID transition (status + paidAt), shared
 * by every settle path (subsidized / credits / live-PAYG) so the terminal
 * transition has a single source of truth — the twin of `persistFinalPrice`.
 *
 * Called FIRST inside the settling tx: the claim's row lock serializes the
 * settle against the CAS-guarded voiders (`markShareUnpayableAndUnlock`, the
 * account-deletion bulk flip), which also lock the share row before touching
 * balances — same lock order, no deadlock, no interleaving. One side commits;
 * the other sees the terminal status and backs off. Without the claim, a void
 * committing mid-settle would release the SHARE_LOCK while the settle consumes
 * it (double release), and the settle would clobber UNPAYABLE with PAID.
 *
 * `extra` carries the one path-specific column: the retry-exhausted PAYG path
 * also persists `paygChargeAttempts` atomically with the PAID flip.
 */
export async function markSharePaidOrThrow(
  tx: Prisma.TransactionClient,
  shareId: number,
  extra?: { paygChargeAttempts?: number },
): Promise<void> {
  const claimed = await tx.share.updateMany({
    where: { id: shareId, ...PROCESSING_SHARE_WHERE },
    data: { status: "PAID", paidAt: new Date(), ...extra },
  });
  if (claimed.count === 0) {
    throw new ShareNotProcessingError(shareId);
  }

  // The report hold, re-checked ATOMICALLY with the claim. The candidate query
  // (`findSharesReadyForPayment`) excludes shares with a PENDING/VALID report,
  // but a report filed — or ruled VALID by an admin verdict — between that scan and
  // this tx would otherwise still settle: the hold would be violated, and a
  // VALID verdict's lock release could double-move money against this settle.
  // The claim above holds the share row lock, so a committed verdict is
  // visible here and an in-flight review serializes against us (the review tx
  // re-locks the share row before releasing). A held share aborts exactly like
  // a lost claim: tx rolls back, worker skips; a DISMISSED verdict makes it
  // payable again on a later pass.
  const report = await tx.shareReport.findUnique({
    where: { shareId },
    select: { status: true },
  });
  if (isPendingOrValidReport(report)) {
    throw new ShareNotProcessingError(shareId);
  }
}
