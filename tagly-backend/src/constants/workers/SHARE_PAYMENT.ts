/**
 * Tunables for the share payment worker.
 *
 * This worker polls for shares ready to pay — PROCESSING + APPROVED with the
 * insights and snapshot rows captured and aged past `minPaymentAgeMs` (see
 * findSharesReadyForPayment). It runs as a polling loop without job queues; shares
 * are picked up directly by that query. Payment is idempotent via ledger event
 * external refs, and every settle tx opens with the atomic PROCESSING → PAID
 * claim (markSharePaidOrThrow) so a settle can never race a concurrent void.
 */
import type { WorkerLoopTunables } from "./types.js";

export const sharePaymentWorkerTunables = {
  /** Max shares to process in parallel per loop iteration */
  concurrency: 8,

  /** Max shares to fetch per loop iteration */
  claimBatchSize: 32,

  /** Sleep duration when no shares are ready for payment (5 sec) */
  loopIdleMs: 5_000,

  /** Sleep duration after a loop-level error (1 sec) */
  errorSleepMs: 1_000,

  /** Jitter for sleeps to avoid thundering herds (±20%) */
  jitterPct: 0.2,

  /**
   * Minimum share age before it may be paid, measured from `createdAt` (24h).
   * Gives admins a guaranteed window to review/approve before any payout, even
   * for shares posted to Instagram well before the share was created (those
   * could otherwise reach POST_SNAPSHOT almost immediately). Combined with the
   * approvalStatus = APPROVED gate in findSharesReadyForPayment.
   */
  minPaymentAgeMs: 24 * 60 * 60 * 1000,

  /**
   * Backoff before re-attempting a share whose settle failed on a TRANSIENT
   * (non-domain) error — DB hiccup, Stripe timeout, network (1 hour). Every
   * ledger write is idempotent, so the retry is safe; only deliberate domain
   * errors (createCustomError) void a share to UNPAYABLE. The deferral reuses
   * the `paygNextRetryAt` gate in findSharesReadyForPayment, which applies to
   * every share, not just PAYG.
   */
  transientRetryBackoffMs: 60 * 60 * 1000,
} as const satisfies WorkerLoopTunables;
