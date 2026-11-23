import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { AnyNumber } from "../../helpers/types.js";
import { bpsOfCents } from "../../../../formatting/bpsOfCents.js";
import { LOCK_BPS_OF_EST_PRICE } from "../../../../../constants/rewards/PRICING.js";
import { retrieveAvailableStripeBalance } from "../../../stripe/retrieveAvailableStripeBalance.js";
import { SHARE_LOCK_META_KEYS } from "./shareLockMeta.js";

/**
 * Reserves funds for a share by locking 150% of the estimated price
 * (minimum 1 cent — zero-estimate shares still get a SHARE_LOCK event,
 * which settlement requires as its currency source of truth).
 *
 * Routes based on the isSubsidized flag, which the caller derives from whether the
 * local has an open SubsidizationPeriod right now (at share creation time):
 *   - isSubsidized=false: moves available → locked on AdvertiserSensitiveData
 *   - isSubsidized=true: checks live Stripe balance, then increments PlatformBalance.lockedCents
 *
 * NOTE: do not derive isSubsidized from advertiserId — advertiserId is not a reliable
 * subsidization signal (see tagly-backend/CLAUDE.md §Subsidized Share Invariant).
 */
export async function lockBudgetForShare(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId?: number;
    isSubsidized: boolean; // passed from caller — do not derive from advertiserId
    shareId: number;
    estimatedPriceCents: AnyNumber;
    currency: string;
    meta?: Prisma.InputJsonObject;
    /**
     * Advertiser path only. When true, a budget that can't cover the full
     * 1.5× lock doesn't fail with 1516 — the lock is capped at the current
     * available budget instead (lock = min(1.5 × est, available)). Throws
     * 1516 only when nothing is available (≤ 0). Settlement still pays the
     * customer IN FULL (the un-locked remainder draws available negative —
     * the advertiser receivable; see settleSharePayoutAndUnlockRemainder);
     * the cap only bounds what is *reserved*. Used by adminApproveShare for
     * CREDITS shares.
     */
    capAtAvailableBudget?: boolean;
  },
): Promise<{
  event: TransactionLedgerEvent;
  lockCents: bigint;
  created: boolean;
}> {
  const { advertiserId, shareId, isSubsidized, currency } = input;

  if (!isSubsidized && !advertiserId) {
    throw createCustomError(
      1511,
      "advertiserId required for non-subsidized share",
      400,
    );
  }

  const externalRef = `share:${shareId}:lock:v1`;

  if (!shareId || shareId <= 0) {
    throw createCustomError(1512, "shareId required", 400);
  }

  const estimatedPrice = asBigInt(input.estimatedPriceCents);
  if (estimatedPrice < 0n) {
    throw createCustomError(1514, "estimated price must be >= 0", 400);
  }

  const fullLockCents = bpsOfCents(estimatedPrice, LOCK_BPS_OF_EST_PRICE);
  // Zero-estimate shares are approvable: lock a 1-cent minimum instead of
  // failing. Settlement REQUIRES a SHARE_LOCK event to exist for CREDITS
  // (1608) and SUBSIDIZED (1623) shares — it is the currency source of truth
  // — so the lock can never be skipped entirely. If the final price ends up
  // 0 the cent is unlocked; if > 0, settlement tops up from available as with
  // any partial lock.
  // May also be reduced below (advertiser path) when capAtAvailableBudget is set.
  let lockCents = fullLockCents < 1n ? 1n : fullLockCents;

  // --- Idempotency check (shared by both paths) ---
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.SHARE_LOCK },
    },
  });
  if (existing) {
    return { event: existing, lockCents, created: false };
  }

  if (isSubsidized) {
    // --- Platform path ---
    // Stripe balance is fetched outside the DB transaction context (HTTP call).
    // DB aggregations inside retrieveAvailableStripeBalance run within tx.
    const { unassignedCents } = await retrieveAvailableStripeBalance(tx);
    if (BigInt(unassignedCents) < lockCents) {
      throw createCustomError(1517, "insufficient platform balance", 409);
    }

    let event: TransactionLedgerEvent;
    try {
      event = await createLedgerEvent(tx, {
        kind: TransactionKind.SHARE_LOCK,
        shareId,
        currency,
        // Move platform available → locked (mirrors advertiser path, zero-sum)
        deltaPlatformCents: -lockCents,
        deltaPlatformLockedCents: lockCents,
        externalRef,
        meta: {
          ...(input.meta ?? {}),
          estimatedPriceCents: estimatedPrice.toString(),
          lockMultiplierBps: LOCK_BPS_OF_EST_PRICE,
          ...(fullLockCents < 1n ? { minimumLockApplied: true } : {}),
        },
        enforceZeroSum: true,
        idempotentOnExternalRef: false,
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        const again = await tx.transactionLedgerEvent.findUnique({
          where: {
            externalRef_kind: { externalRef, kind: TransactionKind.SHARE_LOCK },
          },
        });
        if (again) return { event: again, lockCents, created: false };
      }
      throw err;
    }

    return { event, lockCents, created: true };
  }

  // --- Advertiser path ---
  // Affordability is ALWAYS checked (there is deliberately no bypass flag): a
  // lock either fits the available budget in full, or — in capAtAvailableBudget
  // mode — is reduced to whatever is available (> 0). The post-write re-check
  // below backstops both modes against concurrent lockers.
  {
    const adv = await tx.advertiser.findUnique({
      where: { id: advertiserId },
      select: { sensitiveData: { select: { availableBudgetUsdCents: true } } },
    });
    if (!adv?.sensitiveData) {
      throw createCustomError(1515, "advertiser sensitiveData missing", 500);
    }
    const available = adv.sensitiveData.availableBudgetUsdCents;
    if (input.capAtAvailableBudget) {
      // Partial-lock mode: reserve whatever is available, up to the full
      // 1.5× lock. Nothing available at all → fail like the strict path so
      // the caller's transaction rolls back (share stays PENDING).
      if (available <= 0n) {
        throw createCustomError(1516, "insufficient funds", 409);
      }
      if (available < lockCents) {
        lockCents = available;
      }
    } else if (available < lockCents) {
      throw createCustomError(1516, "insufficient funds", 409);
    }
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.SHARE_LOCK,
      advertiserId,
      shareId,
      currency,
      // Move available → locked (zero-sum for advertiser)
      deltaAdvertiserCents: -lockCents,
      deltaAdvertiserLockedCents: lockCents,
      externalRef,
      meta: {
        ...(input.meta ?? {}),
        [SHARE_LOCK_META_KEYS.estimatedPriceCents]: estimatedPrice.toString(),
        [SHARE_LOCK_META_KEYS.lockMultiplierBps]: LOCK_BPS_OF_EST_PRICE,
        ...(fullLockCents < 1n
          ? { [SHARE_LOCK_META_KEYS.minimumLockApplied]: true }
          : {}),
        // Audit trail for partial locks: the full 1.5× amount that would have
        // been reserved had the budget covered it. Audit-only since the E069
        // policy change (settlement pays in full, so no shortfall to classify).
        ...(lockCents < fullLockCents
          ? {
              [SHARE_LOCK_META_KEYS.cappedAtAvailableBudget]: true,
              [SHARE_LOCK_META_KEYS.requestedLockCents]:
                fullLockCents.toString(),
            }
          : {}),
      },
      enforceZeroSum: true,
      idempotentOnExternalRef: false,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: { externalRef, kind: TransactionKind.SHARE_LOCK },
        },
      });
      if (again) return { event: again, lockCents, created: false };
    }
    throw err;
  }

  // Concurrency hardening (advertiser path, strict AND capAtAvailableBudget):
  // the affordability guard above is a plain pre-write read, so two concurrent
  // approvals of a thin budget can both pass it and oversubscribe. The SHARE_LOCK
  // write just applied `available -= lockCents` atomically (row-locked), so
  // re-read within THIS tx: if the balance went negative, a racing approval got
  // there first — throw 1516 to roll back (the share stays PENDING) while the
  // winner commits. Only the loser sees the post-increment negative value.
  const afterLock = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: { sensitiveData: { select: { availableBudgetUsdCents: true } } },
  });
  if ((afterLock?.sensitiveData?.availableBudgetUsdCents ?? 0n) < 0n) {
    throw createCustomError(1516, "insufficient funds", 409);
  }

  return { event, lockCents, created: true };
}
