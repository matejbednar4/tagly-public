import { TransactionLedgerEvent } from "../../../../generated/prisma/client.js";
import { queueNotificationJobs } from "../../../queue/queueNotificationJobs.js";
import {
  hasActiveAdvertiserPaygPeriod,
  isInLowBudgetWarningBand,
  LOW_BUDGET_THRESHOLD_CENTS,
} from "../../../businesses/businessAccessibility.js";

/**
 * Best-effort advertiser notifications fired after a ledger event changes the
 * advertiser's balance.
 *
 * Scope: **one event fact** — the "credits running low" heads-up at the exact
 * debit that enters the ending-soon band (this band only ever moves via ledger
 * events, so this chokepoint covers every writer — unlike visibility, which
 * flips on non-ledger paths too). The per-share payout notice was removed
 * (2026-07-25): together with `a.shares.created` it double-pinged every share,
 * and the wallet feed already shows each deduction.
 * Visibility transitions themselves are NOT decided here — they belong to the
 * maintenance worker's `reconcileAdvertiserVisibility` (diffs the canonical
 * accessibility rule against `Advertiser.lastKnownVisible`). Don't reintroduce
 * visible/hidden edge detection here.
 */
export const maybeQueueAdvertiserBudgetNotificaions = async (input: {
  advertiser: {
    id: number;
    sensitiveData: {
      availableBudgetUsdCents: bigint;
    };
  };
  event: TransactionLedgerEvent;
}) => {
  const { advertiser, event } = input;

  if (event.deltaAdvertiserCents === 0n) {
    return;
  }

  // ---- "Credits running low" nudge: this debit entered the warning band ----
  // Fires only on the threshold crossing (cheap cents short-circuit before the
  // PAYG lookup), with final membership decided by the canonical shared
  // predicate — still visible via credits, below the warning threshold, and
  // never for PAYG advertisers (their visibility isn't credits-funded). The
  // event-scoped dedupe absorbs webhook/worker retries.
  if (event.deltaAdvertiserCents < 0n) {
    const availableAfter = advertiser.sensitiveData.availableBudgetUsdCents;
    const availableBefore = availableAfter - event.deltaAdvertiserCents;
    if (
      availableBefore >= LOW_BUDGET_THRESHOLD_CENTS &&
      availableAfter < LOW_BUDGET_THRESHOLD_CENTS
    ) {
      const hasPayg = await hasActiveAdvertiserPaygPeriod(advertiser.id);
      if (isInLowBudgetWarningBand(availableAfter, hasPayg)) {
        await queueNotificationJobs({
          advertiserIds: [advertiser.id],
          eventSlug: "a.reminders.low-balance",
          dedupeKey: `low-balance-${advertiser.id}-${event.id}`,
        });
      }
    }
  }
};
