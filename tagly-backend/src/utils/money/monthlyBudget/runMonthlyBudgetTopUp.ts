import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { isCustomError } from "../../core/errors/createCustomError.js";
import { chargeAdvertiserCardOffSession } from "../stripe/chargeAdvertiserCardOffSession.js";
import { completeOffSessionChargeRow } from "../stripe/offSessionChargeRow.js";
import { createAdvertiserCreditPurchase } from "../ledger/events/creditPurchase/createAdvertiserCreditPurchaseEvent.js";
import { queueNotificationJobs } from "../../queue/queueNotificationJobs.js";
import { reportError } from "../../core/errors/reportError.js";
import { chargeRetryBackoffMs } from "../stripe/chargeRetryBackoffMs.js";
import { closeMonthlyBudgetPeriod } from "./closeMonthlyBudgetPeriod.js";
import {
  monthlyBudgetPeriodKey,
  nextMonthlyBudgetRunAt,
} from "./monthlyBudgetSchedule.js";
import { MONTHLY_BUDGET_TOPUP } from "../../../constants/billing/MONTHLY_BUDGET.js";
import { MONTHLY_BUDGET } from "@tagly/models/shared";

/** Outcome of one run. */
export type MonthlyBudgetTopUpOutcome =
  /** The period is gone (closed since the poll) or its run is not due. */
  | { kind: "NOT_DUE" }
  | { kind: "SKIPPED"; availableCents: bigint; targetCents: bigint }
  | { kind: "CHARGED"; amountCents: number; targetCents: bigint }
  | {
      kind: "DECLINED";
      attempts: number;
      /** True when attempts are exhausted and the period was closed (CHARGE_FAILED). */
      paused: boolean;
      nextRetryAt: Date | null;
    }
  | { kind: "DEFERRED" };

/**
 * The per-(month, period, attempt) charge identity — used as BOTH the Stripe
 * idempotency key AND `StripeCreditPurchase.externalRef`, so the DB row and
 * the Stripe request are 1:1 and a retry always finds the exact charge a prior
 * run may have placed (see `chargeAdvertiserCardOffSession`).
 *
 * Why this is collision-free without a run counter: a period is immutable
 * (a new target = a new period) and tops up once when opened, so any one
 * period runs at most once per calendar month; within that run the attempt
 * number separates declines.
 *
 * ⚠️ Never call this directly to re-derive the key of an attempt already in
 * flight — go through `resolveAttemptRef`, which reuses the persisted one. The
 * month component makes this function's output time-dependent, which is safe
 * only when it is called exactly once per attempt.
 */
const attemptChargeKey = (
  periodKey: string,
  periodId: number,
  attemptNo: number,
) => `monthly-budget:${periodKey}:${periodId}:attempt:${attemptNo}:v1`;

/**
 * The key a run charges under: the one this attempt already minted
 * (`currentAttemptRef`), or a fresh one for a new attempt.
 *
 * **The month component is load-bearing and the key must be remembered, not
 * recomputed.** `periodKey` comes from the run's wall clock, so an ambiguous
 * outcome (1342) whose recheck lands after a UTC month rollover would otherwise
 * recompute a DIFFERENT key, miss the maybe-collected charge in the pre-check,
 * and place a second one. Nor can that be repaired by looking the attempt up
 * without the month: `chargeAttempts` resets every month, so
 * (periodId, attempt) matches LAST month's charge just as well as this one's —
 * a month-blind lookup would read October's completed row on November's run
 * and skip the charge entirely. Hence: mint once, persist, reuse until the
 * attempt reaches a terminal outcome.
 */
function resolveAttemptRef(
  period: {
    id: number;
    chargeAttempts: number;
    currentAttemptRef: string | null;
  },
  now: Date,
): { ref: string; minted: boolean } {
  if (period.currentAttemptRef) {
    return { ref: period.currentAttemptRef, minted: false };
  }
  return {
    ref: attemptChargeKey(
      monthlyBudgetPeriodKey(now),
      period.id,
      period.chargeAttempts,
    ),
    minted: true,
  };
}

/** `$12.34` — the wire-agnostic USD figure the notification templates render. */
export const formatUsdCents = (cents: bigint | number) =>
  `$${(Number(cents) / 100).toFixed(2)}`;

/**
 * Run the advertiser's open monthly-budget period for the calendar month of
 * `now`: charge the saved card `target − available` so they hold `target`.
 *
 * **Called ONLY by the stripe worker** (`reconcileMonthlyBudgets`, under its
 * singleton advisory lock) — for a period whose `nextRunAt` has passed: the 1st
 * of the month, a backed-off retry, or an ambiguous recheck. **Activation never
 * schedules a run** (`openMonthlyBudgetPeriod` books the next 1st), so no user
 * action can trigger a charge and no charge can land near a UTC month boundary
 * — the retry ladder caps at 24h, putting the last possible attempt on the 2nd.
 * One writer means there is no charge race to survive at all; the `externalRef`
 * + Stripe idempotency guard below is then purely for crash/retry safety within
 * that one writer.
 *
 * Sequence:
 *  1. The polled period, re-asserted still open AND still due — otherwise
 *     NOT_DUE. ("Already ran this month" needs no separate check: every
 *     outcome below moves `nextRunAt` into a later month or retry slot.)
 *  2. `shortfall = target − available` (available may be NEGATIVE — the E069
 *     receivable — which makes the charge bigger and settles the debt).
 *  3. Pre-check: if this attempt's `externalRef` row is already COMPLETED, the
 *     webhook / reconcile worker booked a charge this run couldn't confirm
 *     earlier (an ambiguous outcome) → finalize as CHARGED, never re-collect.
 *  4. Below `MIN_TOPUP_CENTS` → SKIPPED: schedule next month, no charge, no
 *     email.
 *  5. Charge off-session (flow `MONTHLY_BUDGET_TOPUP`: `kind: CREDIT_PURCHASE`,
 *     no surcharge, purpose `monthly_budget_topup`, worker-reconcilable). Then
 *     in ONE transaction:
 *     book the ledger `CREDIT_PURCHASE` under `stripe_pi_{id}` — deliberately
 *     the SAME externalRef `handlePaymentIntentSucceeded` uses, so whichever
 *     of this path / the webhook lands first wins and the other no-ops —
 *     complete the row, schedule next month. Then queue the receipt.
 *  6. **1337 (definitive decline):** bump attempts; below MAX back off
 *     (`nextRunAt = now + backoff`), at MAX close the period CHARGE_FAILED
 *     (the "pause") and email the advertiser. **1342 (ambiguous):** consume no
 *     attempt, keep the key, recheck shortly — the same contract as
 *     `settlePaygShare` (E020/E064: booking an ambiguous outcome as a decline
 *     rotates the key and is how double charges happen).
 *
 * Every outcome moves `nextRunAt` forward, so the worker never re-picks a
 * period in a hot loop. Double-charge protection is the `externalRef` unique
 * index + Stripe idempotency key on the attempt row (a crashed run's retry
 * finds its own completed/pending row instead of charging again), under the
 * stripe worker's singleton lock — and the key itself is **persisted on the
 * period** (`currentAttemptRef`) rather than recomputed, so an unresolved
 * attempt resumes under the same identity even across a UTC month rollover.
 * See `resolveAttemptRef` for why both halves of that (remembering it, and
 * keeping the month in it) are required.
 */
export async function runMonthlyBudgetTopUp(
  periodId: number,
  advertiserId: number,
  now: Date = new Date(),
): Promise<MonthlyBudgetTopUpOutcome> {
  // Load the EXACT period the poller picked, and re-assert that it is still
  // open and still due. Both halves matter, and neither is belt-and-braces:
  //
  // Resolving by `advertiserId` instead let a `PUT /monthly-budget` landing
  // mid-batch swap the period out from under the run — `setMonthlyBudget`
  // closes the due period and opens a replacement scheduled for the 1st of
  // NEXT month, which the run would then load and charge on the spot, at the
  // new target, seconds after the app promised nothing would be charged. That
  // is exactly the "no user action can trigger a charge" invariant this
  // feature is built on (see `openMonthlyBudgetPeriod`).
  //
  // The `nextRunAt` guard closes the same hole from the other side: the batch
  // is a snapshot (up to `monthlyBudgetBatchSize` periods, each with a Stripe
  // round trip), so by the time a row is reached its schedule may have moved.
  //
  // `advertiserId` is matched as well, so the pair must agree before any money
  // moves ("validate IDs before charging" — the ownership rule). The caller
  // reads both off one row so they cannot realistically disagree; the point is
  // that charging the wrong account becomes impossible rather than unreachable.
  const period = await prisma.monthlyBudgetPeriod.findFirst({
    where: {
      id: periodId,
      advertiserId,
      endedAt: null,
      nextRunAt: { lte: now },
    },
    select: {
      id: true,
      targetCents: true,
      nextRunAt: true,
      chargeAttempts: true,
      currentAttemptRef: true,
    },
  });
  if (!period) return { kind: "NOT_DUE" };

  const periodKey = monthlyBudgetPeriodKey(now);
  const attemptNo = period.chargeAttempts;

  // 2) Shortfall against the live available balance.
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { sensitiveData: { select: { availableBudgetUsdCents: true } } },
  });
  const available = adv?.sensitiveData?.availableBudgetUsdCents ?? 0n;
  const target = period.targetCents;
  const shortfall = target - available;

  const { ref, minted } = resolveAttemptRef(period, now);

  // 3) Pre-check: a charge this attempt already collected AND booked
  // elsewhere (webhook / reconcile worker after an ambiguous outcome).
  const existing = await prisma.stripeCreditPurchase.findUnique({
    where: { externalRef: ref },
    select: { status: true, amountCents: true },
  });
  if (existing?.status === "COMPLETED") {
    await completeMonth(prisma, period.id, now);
    const amountCents = Number(existing.amountCents);
    await queueChargedNotification(
      advertiserId,
      periodKey,
      amountCents,
      target,
    );
    return { kind: "CHARGED", amountCents, targetCents: target };
  }

  // 4) Already at (or within the floor of) the target — nothing to charge.
  if (shortfall < BigInt(MONTHLY_BUDGET.MIN_TOPUP_CENTS)) {
    // A skip can follow a decline (the advertiser topped up manually before
    // the retry) — the month is complete either way, failure detail included.
    await completeMonth(prisma, period.id, now);
    return { kind: "SKIPPED", availableCents: available, targetCents: target };
  }

  // Remember the key BEFORE charging, so a crash — or an ambiguous answer whose
  // recheck lands in the next UTC month — resumes under the exact same identity
  // instead of minting a second one. Nothing below re-derives it.
  if (minted) {
    await prisma.monthlyBudgetPeriod.update({
      where: { id: period.id },
      data: { currentAttemptRef: ref },
    });
  }

  // 5) Charge the saved card (outside any tx).
  let charge;
  try {
    // CREDIT_PURCHASE, no surcharge, `monthly_budget_topup`, worker-reconciled
    // — the charger owns that tuple; see its FLOWS table.
    charge = await chargeAdvertiserCardOffSession(
      advertiserId,
      Number(shortfall),
      { flow: "MONTHLY_BUDGET_TOPUP", attemptRef: ref },
    );
  } catch (err) {
    if (isCustomError(err) && err.error.code === 1342) {
      // Ambiguous: the charge MAY have been collected. Consume no attempt and
      // — critically — leave `currentAttemptRef` set, so the recheck resumes
      // under the same Stripe idempotency key even if it lands in the next UTC
      // month. Clearing it here would re-open the double-charge window.
      await prisma.monthlyBudgetPeriod.update({
        where: { id: period.id },
        data: {
          nextRunAt: new Date(
            now.getTime() + MONTHLY_BUDGET_TOPUP.AMBIGUOUS_RECHECK_MS,
          ),
        },
      });
      return { kind: "DEFERRED" };
    }
    // Definitive decline (1337) — or a pre-charge domain failure (no card on
    // file etc., which removeSavedCard makes unreachable for an open period).
    return handleDecline(
      advertiserId,
      period.id,
      periodKey,
      ref,
      attemptNo,
      now,
    );
  }

  // Charge succeeded — money is in. Book it; a failure here must NOT lose the
  // charge: the PI id is stamped on the externalRef row, so the reconcile
  // worker (or this run's next pick-up via the pre-check / byte-stable
  // replay) books it. Defer briefly rather than hot-loop.
  try {
    await prisma.$transaction(async (tx) => {
      await createAdvertiserCreditPurchase(tx, {
        advertiserId,
        deltaAdvertiserCents: charge.amountCents,
        externalRef: `stripe_pi_${charge.paymentIntentId}`,
        stripeCreditPurchaseId: charge.stripeCreditPurchaseId,
        meta: {
          stripe: { paymentIntentId: charge.paymentIntentId },
          monthlyBudget: {
            periodId: period.id,
            periodKey,
            attempt: attemptNo,
            targetCents: target.toString(),
            availableBeforeCents: available.toString(),
          },
        },
      });
      await completeOffSessionChargeRow(tx, charge);
      await completeMonth(tx, period.id, now);
    });
  } catch (err) {
    reportError(err, {
      source: "worker",
      // Self-healing (the reconcile worker books the collected charge) but
      // money-relevant → alert a human as well as capture.
      errorClass: "unexpected",
      service: "monthlyBudget",
      advertiserId,
      note: "post-charge booking failed; the reconcile worker / next run books the collected charge",
      notify: true,
      notifyKey: `monthly-budget-post-charge-booking-fail:${period.id}:${periodKey}`,
    });
    await prisma.monthlyBudgetPeriod
      .update({
        where: { id: period.id },
        data: {
          nextRunAt: new Date(
            now.getTime() + MONTHLY_BUDGET_TOPUP.AMBIGUOUS_RECHECK_MS,
          ),
        },
      })
      .catch(() => {});
    return { kind: "DEFERRED" };
  }

  await queueChargedNotification(
    advertiserId,
    periodKey,
    charge.grossCents,
    target,
  );
  return {
    kind: "CHARGED",
    amountCents: charge.grossCents,
    targetCents: target,
  };
}

/**
 * The month's terminal outcome (charged, booked elsewhere, or skipped): the
 * period is scheduled one run ahead and its retry state cleared — including
 * the last decline detail, so a period that recovered (a retry that charged,
 * or a skip after a manual top-up) doesn't keep showing a stale failure.
 *
 * **`currentAttemptRef` must be cleared here**, or next month's run would reuse
 * this month's key: the pre-check would find its own COMPLETED row and skip the
 * charge, silently, every month.
 */
async function completeMonth(
  db: Prisma.TransactionClient,
  periodId: number,
  now: Date,
): Promise<void> {
  await db.monthlyBudgetPeriod.update({
    where: { id: periodId },
    data: {
      nextRunAt: nextMonthlyBudgetRunAt(now),
      chargeAttempts: 0,
      currentAttemptRef: null,
      lastFailureCode: null,
      lastFailureMessage: null,
    },
  });
}

/** The monthly receipt — once per period per month (dedupe on both). */
async function queueChargedNotification(
  advertiserId: number,
  periodKey: string,
  amountCents: number,
  targetCents: bigint,
) {
  await queueNotificationJobs({
    eventSlug: "a.balance.monthly-budget-charged",
    advertiserIds: [advertiserId],
    payload: {
      amountFormatted: formatUsdCents(amountCents),
      targetFormatted: formatUsdCents(targetCents),
    },
    dedupeKey: `monthly-budget-charged:${advertiserId}:${periodKey}:${targetCents}`,
  });
}

/**
 * A charge declined. Below MAX_CHARGE_ATTEMPTS: back off and keep the period
 * open (the card is retried). At MAX: close the period CHARGE_FAILED — the
 * "pause" — and email the advertiser to update their card. The card stays on
 * file either way (mirrors PAYG's `handleDecline`).
 */
async function handleDecline(
  advertiserId: number,
  periodId: number,
  periodKey: string,
  ref: string,
  attemptNo: number,
  now: Date,
): Promise<MonthlyBudgetTopUpOutcome> {
  const attempts = attemptNo + 1;
  // The charge util stamps Stripe's decline detail on the attempt row.
  const row = await prisma.stripeCreditPurchase.findUnique({
    where: { externalRef: ref },
    select: { failureCode: true, failureMessage: true },
  });
  const failure = {
    lastFailureCode: row?.failureCode ?? null,
    lastFailureMessage: row?.failureMessage ?? null,
  };

  if (attempts >= MONTHLY_BUDGET_TOPUP.MAX_CHARGE_ATTEMPTS) {
    const closed = await prisma.$transaction(async (tx) => {
      await tx.monthlyBudgetPeriod.update({
        where: { id: periodId },
        // The attempt is over (definitively declined), so its key is retired —
        // a re-enable must mint a fresh one, never resume this dead charge.
        data: { chargeAttempts: attempts, currentAttemptRef: null, ...failure },
      });
      return closeMonthlyBudgetPeriod(advertiserId, "CHARGE_FAILED", tx);
    });
    // Only on the open→closed transition, so a re-run can't double-notify.
    if (closed > 0) {
      await queueNotificationJobs({
        eventSlug: "a.balance.monthly-budget-failed",
        advertiserIds: [advertiserId],
        dedupeKey: `monthly-budget-failed:${advertiserId}:${periodKey}`,
      });
    }
    return { kind: "DECLINED", attempts, paused: true, nextRetryAt: null };
  }

  const nextRetryAt = new Date(
    now.getTime() + chargeRetryBackoffMs(attempts, MONTHLY_BUDGET_TOPUP),
  );
  await prisma.monthlyBudgetPeriod.update({
    where: { id: periodId },
    // Cleared so the NEXT attempt mints its own key: the attempt number is part
    // of the identity, and this one definitively declined (no charge to resume).
    data: {
      chargeAttempts: attempts,
      currentAttemptRef: null,
      nextRunAt: nextRetryAt,
      ...failure,
    },
  });
  return { kind: "DECLINED", attempts, paused: false, nextRetryAt };
}
