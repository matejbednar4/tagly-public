/**
 * Tunables for the Stripe reconciliation worker.
 *
 * This worker polls for PENDING credit purchases that haven't been resolved
 * by the webhook (e.g., webhook delivery failed). It queries Stripe directly
 * to determine terminal status and updates the database accordingly.
 */
import type { WorkerLoopTunables } from "./types.js";

export const stripeWorkerTunables = {
  /** Sleep duration between polling loops when jobs are found or completed */
  // 10s (was 30s): a freshly enabled monthly budget is charged by this
  // worker's next tick — nothing else charges — and the app polls for ~45s
  // after `PUT /monthly-budget`, so the tick must be well inside that. Each
  // tick is a few cheap DB polls; withdrawal/purchase reconciliation just
  // gets faster too.
  loopIdleMs: 10_000, // 10 seconds

  /** Sleep duration after an unexpected error in the main loop */
  errorSleepMs: 5_000, // 5 seconds

  /** Only process credit purchases older than this (gives webhook time to arrive) */
  maxPendingCreditPurchaseAgeMs: 5 * 60_000, // 5 minutes

  /** Cancel/fail credit purchases still pending after this duration */
  failPendingCreditPurchaseAfterMs: 24 * 60 * 60 * 1000, // 24 hours

  /**
   * Withdrawals — only create a missing payout for a PENDING withdrawal older
   * than this. Gives the inline payout create in the withdrawal request path time
   * to have succeeded first, so the worker only steps in when that failed (e.g.
   * funds not yet available on the connected account).
   */
  createWithdrawalPayoutAfterMs: 10 * 60_000, // 10 minutes

  /**
   * Withdrawals — only try to resolve a PENDING withdrawal with no transfer id
   * once it's older than this (W-3a / W-16). Gives the inline transfer create (or
   * its transferId persist) time to have landed first, so the missing-transfer
   * pass only steps in for genuine crash / ambiguous-error gaps.
   */
  resolveMissingTransferAfterMs: 10 * 60_000, // 10 minutes

  /**
   * Withdrawals — how far before a row's createdAt to look when listing Stripe
   * transfers to adopt-or-create for the missing-transfer pass (D5). Generous so
   * an old stuck row is still matchable; the metadata `withdrawalUid` match is
   * what actually identifies the transfer.
   */
  transferAdoptLookbackMs: 24 * 60 * 60 * 1000, // 24 hours

  /** Max Stripe transfers to page through when adopting a missing transfer. */
  transferAdoptListLimit: 100,

  /**
   * Withdrawals — only poll a still-PENDING withdrawal that already has a payout
   * once it's older than this. Well past the normal payout settlement + webhook
   * window, so we never poll in-flight payouts — this is purely a missed-webhook
   * backstop for payouts that should have resolved by now.
   */
  pollWithdrawalPayoutAfterMs: 4 * 24 * 60 * 60 * 1000, // 4 days

  /** Max number of jobs to process per loop iteration */
  batchSize: 50,

  /**
   * Monthly budget — max due periods topped up per pass. Each top-up is one
   * off-session Stripe call; the batch bounds a cycle's length so the
   * withdrawal passes still run promptly on the 1st. (The upcoming-charge
   * notices are a maintenance task and use that worker's batch size.)
   */
  monthlyBudgetBatchSize: 50,

  /** Base delay for exponential backoff on retries */
  reconcileBaseDelayMs: 30_000, // 30 seconds

  /** Maximum delay cap for exponential backoff */
  reconcileMaxDelayMs: 30 * 60_000, // 30 minutes

  /** Cap exponent growth to prevent overflow */
  reconcileMaxExpSteps: 10,

  /** Jitter ratio for retry delays (+/- this percentage) */
  reconcileJitterRatio: 0.2, // +/-20%

  /**
   * Withdrawals — payout retry policy (withdrawals.md D3/D4). A FAILED/CANCELED
   * payout is retried with exponential backoff until this many attempts, then the
   * row parks (stays DELAYED) and the team is alerted by ops email.
   */
  maxPayoutAttempts: 5,

  /** Base delay before the first payout retry (doubles per attempt) */
  payoutRetryBaseDelayMs: 60 * 60_000, // 1 hour

  /** Cap for the payout retry backoff */
  payoutRetryMaxDelayMs: 24 * 60 * 60_000, // 24 hours

  /**
   * Withdrawals — recheck delay after an AMBIGUOUS payout-create failure (W-19).
   * The payout may exist with only the response lost; the same-key recheck
   * either replays the created payout (adopts it) or re-attempts. Short-ish so
   * a maybe-created payout is adopted quickly, but far above the 30s loop so an
   * error saved under the idempotency key isn't replayed thousands of times.
   */
  payoutCreateAmbiguousRecheckMs: 10 * 60_000, // 10 minutes

  /**
   * Withdrawals — W-21 funds-availability deferral. When the payout create is
   * blocked ONLY because the transferred funds are still `pending` on the
   * connected account, the retry is scheduled against the balance
   * transaction's own `available_on` instead of the blind W-19 backoff, and NO
   * attempt is consumed. Stripe releases funds during the day of the
   * `available_on` stamp, not at its exact moment (observed ~8h lag), so wake
   * a little after it.
   */
  payoutFundsAvailabilityBufferMs: 2 * 60 * 60_000, // 2 hours

  /**
   * Withdrawals — W-21 recheck cadence once `available_on` (+ buffer) has
   * passed but the funds still report `pending` (release lag), and the floor
   * of every deferral wait. Hourly: cheap (two Stripe reads per check, no
   * create call, no idempotency key burned) and bounds how long a customer
   * waits after the actual release.
   */
  payoutFundsPendingRecheckMs: 60 * 60_000, // 1 hour

  /**
   * Withdrawals — W-21 horizon alert. Deferral is attempt-free so it can never
   * park, which also means it could wait silently forever on a pathological
   * account (funds that never release). A row still deferring this long after
   * creation escalates to the team (deduped by `TEAM_ALERT.DEDUPE_WINDOW_MS`)
   * — normal availability is T+1, and even a 7-day `delay_days` account clears
   * well inside this.
   */
  payoutFundsAvailabilityAlertAfterMs: 14 * 24 * 60 * 60_000, // 14 days
} as const satisfies WorkerLoopTunables;
