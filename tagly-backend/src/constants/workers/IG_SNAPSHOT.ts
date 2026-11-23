/**
 * Tunables for the Instagram snapshot worker.
 *
 * This worker captures audience data (follower count, location breakdown) from Instagram
 * after insights have been collected. The snapshot data is used to calculate share payouts
 * based on the creator's audience reach in the local's area.
 */
import type { JobQueueTunables } from "./types.js";

export const snapshotWorkerTunables = {
  /** Max jobs to process in parallel per loop iteration */
  concurrency: 4,

  /**
   * Max jobs to claim per loop iteration. Effectively capped at `concurrency`:
   * the runner claims `min(claimBatchSize, concurrency)` so it never charges an
   * attempt to a job it won't execute this tick (see `runJobQueue`).
   */
  claimBatchSize: 16,

  /** Sleep duration when no jobs are ready (5 sec) */
  loopIdleMs: 5_000,

  /** Sleep duration after loop-level error (1 sec) */
  errorSleepMs: 1_000,

  /** A job is considered stuck after this duration (5 min) */
  processingLeaseMs: 5 * 60 * 1000,

  /**
   * Per-job wall-clock deadline (4.5 min < the 5 min lease). Worst legit run is
   * up to ~40 sequential geocodes + 4 IG fetches.
   */
  jobTimeoutMs: 270 * 1000,

  /** After this many attempts, mark job as FAILED */
  maxAttemptsPerJob: 5,

  /** Base delay for exponential backoff (5 sec) */
  backoffBaseMs: 5_000,

  /** Maximum backoff delay (5 min) */
  backoffCapMs: 5 * 60 * 1000,

  /** Jitter for sleeps to avoid thundering herds (±20%) */
  jitterPct: 0.2,
} as const satisfies JobQueueTunables;
