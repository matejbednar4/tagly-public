import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";

/**
 * Unlocks platform budget that was locked for a subsidized share.
 * Called on payment failure to return the lock to PlatformBalance.
 */
export async function unlockPlatformBudgetForShare(
  tx: Prisma.TransactionClient,
  input: {
    shareId: number;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{
  event: TransactionLedgerEvent | null;
  unlocked: bigint;
}> {
  const { shareId, meta } = input;

  if (!shareId || shareId <= 0) {
    throw createCustomError(1630, "shareId required", 400);
  }

  // Pull the original SHARE_LOCK event so we can mirror its currency on the
  // unlock. Subsidized locks debit the platform pool, so we mirror the same
  // currency-tagged platform balance column when releasing.
  const lockEvent = await tx.transactionLedgerEvent.findFirst({
    where: { shareId, kind: TransactionKind.SHARE_LOCK },
    select: { deltaPlatformLockedCents: true, currency: true },
  });
  const lockedForShare = lockEvent?.deltaPlatformLockedCents ?? 0n;

  if (lockedForShare <= 0n) {
    return { event: null, unlocked: 0n };
  }

  const event = await createLedgerEvent(tx, {
    kind: TransactionKind.SHARE_UNLOCK,
    shareId,
    currency: lockEvent!.currency,
    deltaPlatformCents: lockedForShare,
    deltaPlatformLockedCents: -lockedForShare,
    externalRef: `share:${shareId}:unlock:v1`,
    enforceZeroSum: true,
    idempotentOnExternalRef: true,
    meta,
  });

  return { event, unlocked: lockedForShare };
}
