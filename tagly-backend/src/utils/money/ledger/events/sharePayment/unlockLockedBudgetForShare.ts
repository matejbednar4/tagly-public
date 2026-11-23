import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";

export async function unlockLockedBudgetForShare(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    shareId: number;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{
  event: TransactionLedgerEvent | null;
  lockedBefore: bigint;
  unlocked: bigint;
}> {
  const { advertiserId, shareId, meta } = input;

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1601, "advertiserId required", 400);
  }

  if (!shareId || shareId <= 0) {
    throw createCustomError(1603, "shareId required", 400);
  }

  // Pull the original SHARE_LOCK event so we can mirror its currency on the
  // unlock. The unlock must use the same currency the lock was recorded in so
  // the advertiser's currency-typed budget row is correctly reversed.
  const lockEvent = await tx.transactionLedgerEvent.findFirst({
    where: { shareId, advertiserId, kind: TransactionKind.SHARE_LOCK },
    select: { deltaAdvertiserLockedCents: true, currency: true },
  });
  const lockedForShare = lockEvent?.deltaAdvertiserLockedCents ?? 0n;

  // If nothing is locked (or net is <= 0), there is nothing to unlock.
  if (lockedForShare <= 0n) {
    return {
      event: null,
      lockedBefore: lockedForShare,
      unlocked: 0n,
    };
  }

  const unlockRef = `share:${shareId}:unlock:v1`;

  // lockEvent is non-null here — lockedForShare > 0 above guarantees it.
  const event = await createLedgerEvent(tx, {
    kind: TransactionKind.SHARE_UNLOCK,
    advertiserId,
    shareId,
    currency: lockEvent!.currency,
    deltaAdvertiserLockedCents: -lockedForShare,
    deltaAdvertiserCents: lockedForShare,
    externalRef: unlockRef,
    enforceZeroSum: true,
    idempotentOnExternalRef: true,
    meta,
  });

  return {
    event,
    lockedBefore: lockedForShare,
    unlocked: lockedForShare,
  };
}
