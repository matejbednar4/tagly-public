import {
  Prisma,
  TransactionKind,
} from "../../../generated/prisma/client.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { bumpAdvertiserBudgetGen } from "../../pricing/rewardEstCache.js";

/**
 * Applies an event's deltas to the per-currency balance columns on the
 * involved accounts (advertiser, customer, platform). Dispatches on
 * `event.currency` — today only "usd" is wired up, but the explicit guard
 * makes the future CZK addition a localized change (add an `else if` branch
 * that targets `*CzkCents` columns).
 *
 * Returns the freshly-read advertiser/customer rows so downstream notification
 * helpers can compare against thresholds.
 */
export async function applyBalancesFromEvent(
  tx: Prisma.TransactionClient,
  event: {
    kind?: TransactionKind;
    currency: string;
    advertiserId?: number | null;
    deltaAdvertiserCents: bigint;
    deltaAdvertiserLockedCents: bigint;

    customerId?: number | null;
    deltaCustomerCents: bigint;
    deltaCustomerLockedCents: bigint;

    deltaPlatformLockedCents: bigint;
  }
) {
  const {
    kind,
    currency,
    advertiserId,
    deltaAdvertiserCents,
    deltaAdvertiserLockedCents,
    customerId,
    deltaCustomerCents,
    deltaCustomerLockedCents,
    deltaPlatformLockedCents,
  } = event;

  if (currency !== "usd") {
    // Unreachable today — SUPPORTED_CURRENCIES gates this at createLedgerEvent.
    // When CZK lands, add an `else if (currency === "czk")` branch that targets
    // the *CzkCents columns instead.
    throw createCustomError(
      1325,
      `applyBalancesFromEvent: unsupported currency ${currency}`,
      500
    );
  }

  // Advertiser budget
  let adv: {
    id: number;
    sensitiveData: {
      availableBudgetUsdCents: bigint;
      lockedBudgetUsdCents: bigint;
    };
  } | null = null;
  if (
    advertiserId &&
    (deltaAdvertiserCents !== 0n || deltaAdvertiserLockedCents !== 0n)
  ) {
    adv = await tx.advertiser.update({
      where: { id: advertiserId },
      data: {
        sensitiveData: {
          update: {
            availableBudgetUsdCents:
              deltaAdvertiserCents !== 0n
                ? { increment: deltaAdvertiserCents }
                : undefined,
            lockedBudgetUsdCents:
              deltaAdvertiserLockedCents !== 0n
                ? { increment: deltaAdvertiserLockedCents }
                : undefined,
            // No lifetime-purchases accumulator: that figure is derived from
            // the ledger on read (`ledger/advertiserCreditPurchases.ts`).
          },
        },
      },
      select: {
        id: true,
        sensitiveData: {
          select: {
            availableBudgetUsdCents: true,
            lockedBudgetUsdCents: true,
          },
        },
      },
    });

    // The advertiser's fundable capacity just moved → invalidate its cached
    // reward estimates (budget capping flips on/off). This is the single
    // chokepoint every money movement flows through (purchases, refunds,
    // locks/unlocks, settles, PAYG charges — controllers + workers + webhooks), so
    // no individual writer has to remember to bump. Fire-and-forget + fail-open
    // (the bump swallows Redis errors): it must never break a ledger tx.
    // Caveat: this fires IN-tx, so a concurrent pre-commit read could briefly
    // cache under the new gen — bounded by the 24h entry TTL and healed by the
    // next budget event.
    void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});
  }

  let cust: {
    id: number;
    sensitiveData: {
      balanceUsdCents: bigint;
      lockedBalanceUsdCents: bigint;
    };
  } | null = null;
  // customer balance
  if (
    customerId &&
    (deltaCustomerCents !== 0n || deltaCustomerLockedCents !== 0n)
  ) {
    cust = await tx.customer.update({
      where: { id: customerId },
      data: {
        sensitiveData: {
          update: {
            balanceUsdCents:
              deltaCustomerCents !== 0n
                ? { increment: deltaCustomerCents }
                : undefined,
            lockedBalanceUsdCents:
              deltaCustomerLockedCents !== 0n
                ? { increment: deltaCustomerLockedCents }
                : undefined,
          },
        },
      },
      select: {
        id: true,
        sensitiveData: {
          select: { balanceUsdCents: true, lockedBalanceUsdCents: true },
        },
      },
    });
  }

  // Platform locked balance — singleton row, id = 1. Use `update` rather than
  // `updateMany` so a missing singleton hard-fails (P2025) instead of silently
  // no-op'ing.
  if (deltaPlatformLockedCents !== 0n) {
    await tx.platformBalance.update({
      where: { id: 1 },
      data: { lockedUsdCents: { increment: deltaPlatformLockedCents } },
    });
  }

  return { advertiser: adv, customer: cust };
}
