/**
 * Tunables for the Instagram insights worker.
 *
 * This worker fetches engagement metrics (likes, comments, reach, etc.) from Instagram
 * for shares that have been posted. It prioritizes expiring jobs (stories have 24h window)
 * and uses exponential backoff for transient failures.
 */
import type { JobQueueTunables } from "./types.js";

export const insightsWorkerTunables = {
  /** Max jobs to process in parallel per loop iteration */
  concurrency: 4,

  /**
   * Max jobs to claim per loop iteration. Effectively capped at `concurrency`:
   * the runner claims `min(claimBatchSize, concurrency)` so it never charges an
   * attempt to a job it won't execute this tick (see `runJobQueue`).
   */
  claimBatchSize: 32,

  /** A job is considered stuck after this duration (1 min) */
  processingLeaseMs: 60 * 1000,

  /**
   * Per-job wall-clock deadline (45 s < the 60 s lease). Worst legit run is a
   * token refresh (15 s cap) + the insights fetch (8 s cap) ≈ 23 s.
   */
  jobTimeoutMs: 45 * 1000,

  /** Sleep duration when no jobs are ready (5 sec) */
  loopIdleMs: 5_000,

  /** Sleep duration after loop-level error (1 sec) */
  errorSleepMs: 1_000,

  /** IG API request timeout (8 sec) */
  httpTimeoutMs: 8 * 1000,

  /** Sanity limit for response body size */
  maxBodySizeBytes: 256 * 1024,

  /** Base delay for exponential backoff (15 sec) */
  backoffBaseMs: 15_000,

  /** Maximum backoff delay (10 min) */
  backoffCapMs: 10 * 60_000,

  /** After this many attempts, mark job as FAILED */
  maxAttemptsPerJob: 4,

  /** Per-token throttle to stay below IG rate limits (~1 rps with small bursts) */
  perToken: {
    maxBurst: 3,
    refillPerSecond: 1,
  },

  /** Jitter for sleeps to avoid thundering herds (±20%) */
  jitterPct: 0.2,
} as const satisfies JobQueueTunables;
