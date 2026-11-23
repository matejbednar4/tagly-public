import type { Prisma } from "../../../generated/prisma/client.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";

/**
 * The single owner of `StripeWithdrawal` state transitions (withdrawals.md, "One
 * transition owner"). The withdrawal orchestrator, the payout util, the Stripe
 * webhook handlers, and the reconciliation worker all record state through these
 * helpers — nothing else may write `status`, `payoutStatus`, `failureCode` /
 * `failureMessage`, `settledAt`, `payoutAttempts`, `nextPayoutRetryAt`, or
 * `stripePayoutId`.
 *
 * Column semantics (see withdrawals.md "Unified StripeWithdrawal model"):
 *  - `status` is the LEDGER summary only: PENDING (money left the balance,
 *    unresolved) / FAILED (transfer failed, nothing left) / COMPLETED (payout
 *    PAID) / REVERSED (fully clawed back).
 *  - `payoutStatus` tracks the payout leg independently; `stripePayoutId` always
 *    refers to the LATEST payout attempt.
 *
 * Every helper takes a `Prisma.TransactionClient` so it participates in the
 * caller's transaction (the root client is accepted too for standalone writes).
 * Helpers that consume Stripe webhook/poll results return `{ applied }` so the
 * caller can suppress notifications when a stale or duplicate event was ignored.
 */

/** Payout retry backoff: base × 2^(attempt−1), capped (withdrawals.md D3). */
function payoutRetryDelayMs(attempts: number): number {
  const exp = Math.min(Math.max(0, attempts - 1), T.reconcileMaxExpSteps);
  return Math.min(T.payoutRetryBaseDelayMs * 2 ** exp, T.payoutRetryMaxDelayMs);
}

/** The Stripe transfer was created — persist its id (crash-recovery marker). */
export async function recordTransferSucceeded(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number; transferId: string },
): Promise<void> {
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: { stripeTransferId: input.transferId },
  });
}

/**
 * The Stripe transfer was DEFINITIVELY rejected — nothing left the platform.
 * The caller unlocks the balance (ledger) in the same transaction; this only
 * records the terminal row state.
 */
export async function recordTransferFailed(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    failureCode: string | null;
    failureMessage: string;
  },
): Promise<void> {
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      status: "FAILED",
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
    },
  });
}

/**
 * The WITHDRAWAL settle ledger event committed (money off Tagly's books). Must
 * be called inside the SAME transaction as `createWithdrawalFromLocked` so the
 * marker can never disagree with the ledger. Idempotent (first settle wins).
 */
export async function recordSettled(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number },
): Promise<void> {
  await db.stripeWithdrawal.updateMany({
    where: { id: input.withdrawalId, settledAt: null },
    data: { settledAt: new Date() },
  });
}

/** A payout attempt was created on the connected account. */
export async function recordPayoutCreated(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number; payoutId: string },
): Promise<void> {
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      stripePayoutId: input.payoutId,
      payoutStatus: "IN_FLIGHT",
      payoutAttempts: { increment: 1 },
      nextPayoutRetryAt: null,
    },
  });
}

/**
 * `payout.paid` — the money reached the bank. Applies only when the row is still
 * PENDING and the payout is the row's current attempt (stale-attempt guard);
 * adopts the payout id when the create-side persist was lost.
 */
export async function recordPayoutPaid(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number; payoutId: string },
): Promise<{ applied: boolean }> {
  const row = await db.stripeWithdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { status: true, stripePayoutId: true },
  });
  if (!row) return { applied: false };

  if (row.stripePayoutId && row.stripePayoutId !== input.payoutId) {
    // Stale/replayed payout event for a superseded payout id — idempotent no-op.
    return { applied: false };
  }

  // Already resolved (COMPLETED replay, FAILED transfer, REVERSED) — no-op.
  if (row.status !== "PENDING") return { applied: false };

  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      status: "COMPLETED",
      payoutStatus: "PAID",
      stripePayoutId: input.payoutId,
      failureCode: null,
      failureMessage: null,
      nextPayoutRetryAt: null,
    },
  });
  return { applied: true };
}

async function recordPayoutNotPaid(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    payoutId: string;
    failureCode: string | null;
    failureMessage: string | null;
  },
  payoutStatus: "FAILED" | "CANCELED",
): Promise<{ applied: boolean; exhausted: boolean }> {
  const row = await db.stripeWithdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { status: true, payoutStatus: true, stripePayoutId: true, payoutAttempts: true },
  });
  if (!row) return { applied: false, exhausted: false };

  if (row.stripePayoutId && row.stripePayoutId !== input.payoutId) {
    // Stale/replayed payout event for a superseded payout id — idempotent no-op.
    return { applied: false, exhausted: false };
  }

  // Replay of an already-recorded terminal payout state — no-op.
  if (row.payoutStatus === payoutStatus) return { applied: false, exhausted: false };

  // Attempts are counted at create; a payout that predates the counter (or whose
  // create-side persist was lost) still represents one real attempt.
  const attempts = Math.max(row.payoutAttempts, 1);
  const exhausted = attempts >= T.maxPayoutAttempts;

  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      payoutStatus,
      stripePayoutId: input.payoutId,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      // The retry pass (stripe worker) picks the row up once this elapses (W-1).
      nextPayoutRetryAt: exhausted
        ? null
        : new Date(Date.now() + payoutRetryDelayMs(attempts)),
      // Late bounce after COMPLETED (withdrawals.md D1): the bank returned the
      // money to the Connect balance, so the withdrawal is back in flight.
      ...(row.status === "COMPLETED" && { status: "PENDING" as const }),
    },
  });
  return { applied: true, exhausted };
}

/**
 * `payout.failed` — the bank rejected the payout; Stripe returned the funds to
 * the Connect balance. Keeps `status = PENDING` (money already left the
 * platform), schedules the retry, and flips a COMPLETED row back to PENDING on a
 * late bounce (D1). `exhausted` signals the D4 ops alert (sent by the caller
 * after commit).
 */
export async function recordPayoutFailed(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    payoutId: string;
    failureCode: string | null;
    failureMessage: string | null;
  },
): Promise<{ applied: boolean; exhausted: boolean }> {
  return recordPayoutNotPaid(db, input, "FAILED");
}

/** `payout.canceled` — money-wise identical to a failed payout (W-5). */
export async function recordPayoutCanceled(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    payoutId: string;
    failureCode: string | null;
    failureMessage: string | null;
  },
): Promise<{ applied: boolean; exhausted: boolean }> {
  return recordPayoutNotPaid(db, input, "CANCELED");
}

/**
 * The connected account's payout situation just improved — payouts were
 * re-enabled (`account.updated` disabled→enabled edge) or the bank details
 * changed (`account.external_account.created/updated`): make every stuck
 * withdrawal on that account eligible for an immediate attempt by bringing its
 * `nextPayoutRetryAt` forward to now (W-1 fast-retry trigger).
 *
 * **Includes exhausted (parked) rows** (D4 amendment, 2026-07-03): a fix-event
 * is the strongest possible signal that the very thing making payouts fail was
 * just repaired, so parking must not survive it — otherwise a customer who
 * fixes their bank details after the retry budget ran out would never get
 * their money without support. The `maxPayoutAttempts` cap still governs
 * *timed* rescheduling (`recordPayoutFailed/Canceled/CreateFailed` park at the
 * cap), so this grants exactly one attempt per fix-event: another failure
 * re-parks and re-alerts.
 *
 * Covers `payoutStatus NONE` too: a settled row whose payout **create** kept
 * being rejected (W-19 — e.g. payouts were disabled) must also wake up on a
 * fix. IN_FLIGHT/PAID rows are excluded (nothing to retry). Returns how many
 * rows were re-armed.
 */
export async function scheduleImmediatePayoutRetryForAccount(
  db: Prisma.TransactionClient,
  input: { stripeAccountId: string },
): Promise<number> {
  const { count } = await db.stripeWithdrawal.updateMany({
    where: {
      stripeAccountId: input.stripeAccountId,
      status: "PENDING",
      payoutStatus: { in: ["NONE", "FAILED", "CANCELED"] },
    },
    data: { nextPayoutRetryAt: new Date() },
  });
  return count;
}

/**
 * W-19 — the payout **create call** itself failed (no payout object exists, as
 * opposed to a created payout later failing). Stripe saves error results under
 * the idempotency key for ~24h and replays them, so a same-key 30s retry loop
 * makes no real progress — this transition is what turns create failures into
 * bounded, forward-moving state:
 *
 *  - **definitive** rejection (payout certainly not created — shared
 *    classification): count it as an attempt and back off; at the cap, park
 *    (`nextPayoutRetryAt = null`) — the caller sends the D4 ops alert on that
 *    edge. Counting the attempt also rotates the next idempotency key
 *    (`attempts + 1`), so the next scheduled try is a REAL request, not a
 *    cached-error replay. The Stripe error is persisted to `failureCode`/
 *    `failureMessage` ("latest failure" semantics — overwritten per attempt,
 *    cleared by `recordPayoutPaid` on recovery), so a stuck row is diagnosable
 *    from the DB instead of only from worker logs.
 *  - **ambiguous** failure (the payout may exist, response lost): do NOT count
 *    an attempt or rotate the key — schedule a short recheck; the same-key
 *    retry then either replays the created payout (adopted) or re-executes.
 *    `failureCode`/`failureMessage` stay untouched too — the payout may
 *    actually exist, so there is no failure to record yet.
 *
 * W-21 funds-availability throws (1723) never reach this transition — call
 * sites intercept them with `getPayoutFundsAvailableAt` first and route to
 * `recordPayoutCreateDeferred`. If a site ever forgets, 1723 classifies
 * ambiguous here (not a Stripe rejection class, not `permanent`) — an
 * attempt-free short recheck, so the retry budget still can't be burned on
 * unavailable funds.
 *
 * `payoutStatus` is deliberately untouched (still NONE for first-create
 * failures, FAILED/CANCELED for retry-path failures) — the payout leg only
 * ever describes real payout objects. Customer display derives the parked
 * condition from `payoutAttempts` + `nextPayoutRetryAt` instead
 * (`deriveWithdrawalDisplayState`).
 */
export async function recordPayoutCreateFailed(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    definitive: boolean;
    failureCode: string | null;
    failureMessage: string | null;
  },
): Promise<{ exhausted: boolean }> {
  const row = await db.stripeWithdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { payoutAttempts: true },
  });
  if (!row) return { exhausted: false };

  if (!input.definitive) {
    await db.stripeWithdrawal.update({
      where: { id: input.withdrawalId },
      data: {
        nextPayoutRetryAt: new Date(
          Date.now() + T.payoutCreateAmbiguousRecheckMs,
        ),
      },
    });
    return { exhausted: false };
  }

  const attempts = row.payoutAttempts + 1;
  const exhausted = attempts >= T.maxPayoutAttempts;

  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      payoutAttempts: attempts,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      nextPayoutRetryAt: exhausted
        ? null
        : new Date(Date.now() + payoutRetryDelayMs(attempts)),
    },
  });
  return { exhausted };
}

/**
 * W-21 — the payout create was DEFERRED: the transferred funds are still
 * `pending` on the connected account (the shared payout util threw 1723 before
 * ever calling `payouts.create`). Unlike a W-19 definitive failure this
 * consumes NO attempt and rotates NO idempotency key — the money simply isn't
 * payable yet, and burning the bounded retry budget on it is exactly what
 * exhausted wd-G1oqVLiCo (five `balance_insufficient` creates across ~15h
 * against funds that released 9½h after the last attempt).
 *
 * Scheduling: `available_on + payoutFundsAvailabilityBufferMs` (Stripe
 * releases funds during the day of the stamp, not at its exact moment),
 * floored at `now + payoutFundsPendingRecheckMs` so a stamp already in the
 * past (release lag) degrades to a bounded hourly recheck instead of a tight
 * loop. The failure fields record the wait ("latest failure" semantics —
 * overwritten by the next real attempt, cleared by `recordPayoutPaid`) so a
 * deferred row is diagnosable from the DB.
 *
 * Deferral cannot park or exhaust: `maxPayoutAttempts` bounds real attempts
 * only, and every deferral is finite — funds always release or reverse, and a
 * full reversal reaches the terminal 1722 verdict before the W-21 gate. The
 * no-silent-stuck-money guarantee (D4) is kept by the caller-side horizon
 * alert (`payoutFundsAvailabilityAlertAfterMs` in `handlePayoutCreateFailure`).
 */
export async function recordPayoutCreateDeferred(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number; fundsAvailableAt: Date },
): Promise<{ retryAt: Date }> {
  const retryAt = new Date(
    Math.max(
      input.fundsAvailableAt.getTime() + T.payoutFundsAvailabilityBufferMs,
      Date.now() + T.payoutFundsPendingRecheckMs,
    ),
  );
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      nextPayoutRetryAt: retryAt,
      failureCode: "funds_not_yet_available",
      failureMessage: `Transferred funds not yet available on the connected account (Stripe available_on: ${input.fundsAvailableAt.toISOString()}); payout deferred without consuming an attempt.`,
    },
  });
  return { retryAt };
}

/**
 * Stop scheduling automatic payout retries for a withdrawal (the row stays
 * DELAYED and leaves the worker's retry set). Used when reconciliation
 * determines no retry can ever succeed automatically (e.g. an orphaned sweep
 * whose transfer was fully clawed back — W-18). Per D4, parking is always
 * paired with a team alert by the caller: parked money is a human's job.
 */
export async function parkPayoutRetries(
  db: Prisma.TransactionClient,
  input: { withdrawalId: number },
): Promise<void> {
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: { nextPayoutRetryAt: null },
  });
}

/**
 * A transfer reversal was booked (ledger `WITHDRAWAL_REVERSAL` in the same
 * transaction — the ledger stays the source of truth; `reversedCents` mirrors
 * it for reconciliation queries).
 *
 * W-6: `reversedCents` is now the SOLE reversal signal — this helper never
 * touches `failureCode` / `failureMessage` (those mean "latest transfer/payout
 * failure" only). Display and the worker key off `(status, payoutStatus)` and
 * `reversedCents`, never a failure-code sentinel.
 */
export async function recordReversal(
  db: Prisma.TransactionClient,
  input: {
    withdrawalId: number;
    totalReversedCents: bigint;
    fullyReversed: boolean;
  },
): Promise<void> {
  await db.stripeWithdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      reversedCents: input.totalReversedCents,
      ...(input.fullyReversed && { status: "REVERSED" as const }),
    },
  });
}
