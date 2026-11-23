import type { Prisma } from "../../generated/prisma/client.js";
import { TransactionKind } from "../../generated/prisma/client.js";
import { unlockLockedBudgetForShare } from "../money/ledger/events/sharePayment/unlockLockedBudgetForShare.js";
import { unlockPlatformBudgetForShare } from "../money/ledger/events/sharePayment/unlockPlatformBudgetForShare.js";

/**
 * Releases whatever budget a share's original `SHARE_LOCK` debited — the one
 * correct-pool unlock, shared by every path that abandons an in-flight share
 * (`markShareUnpayableAndUnlock`) or kills its payout (a VALID report review).
 *
 * Branches on the lock event's own `advertiserId` + delta columns, never
 * `share.advertiserId` (not a reliable pool signal — a subsidized share can
 * carry an advertiserId after admin assignment, and a CREDITS share can lose
 * its advertiser to deletion). Both unlock wrappers no-op safely when their
 * pool wasn't locked (PENDING-approval never locked; PAYG is lock-less; an
 * already-released share — the `share:{id}:unlock:v1` external ref is
 * idempotent), so this is safe to call whenever the caller has verified the
 * share is still `PROCESSING`.
 *
 * Must run inside the caller's `$transaction`. The caller owns the
 * status/state guard — never release budget for a share that is PAID (money
 * already moved) without a CAS proving it wasn't.
 */
export async function releaseShareLockIfAny(
  tx: Prisma.TransactionClient,
  input: { shareId: number; meta?: Prisma.InputJsonObject }
): Promise<{ released: boolean }> {
  const { shareId, meta } = input;

  const lockEvent = await tx.transactionLedgerEvent.findFirst({
    where: { shareId, kind: TransactionKind.SHARE_LOCK },
    select: {
      advertiserId: true,
      deltaAdvertiserLockedCents: true,
      deltaPlatformLockedCents: true,
    },
  });

  let released = false;

  if (lockEvent?.advertiserId && lockEvent.deltaAdvertiserLockedCents > 0n) {
    const { unlocked } = await unlockLockedBudgetForShare(tx, {
      advertiserId: lockEvent.advertiserId,
      shareId,
      meta,
    });
    released = released || unlocked > 0n;
  }

  if (lockEvent && lockEvent.deltaPlatformLockedCents > 0n) {
    const { unlocked } = await unlockPlatformBudgetForShare(tx, {
      shareId,
      meta,
    });
    released = released || unlocked > 0n;
  }

  return { released };
}
