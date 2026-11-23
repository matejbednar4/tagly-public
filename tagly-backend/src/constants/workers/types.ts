/**
 * Shared shapes that every worker's tunables conform to.
 *
 * The tunable VALUES live in each `<WORKER>.ts` file next to this one; this file
 * only declares the CONTRACT so the runtime framework (`workers/runtime/`) can
 * consume any worker's config typed, and a worker that forgets a required field
 * fails to compile instead of blowing up at runtime.
 *
 * Each worker constant should end with `... as const satisfies WorkerLoopTunables`
 * (domain-poll workers) or `... satisfies JobQueueTunables` (enqueued-job workers).
 * Extra worker-specific fields (retention windows, HTTP timeouts, channel
 * throttles, …) are allowed — `satisfies` only enforces the shared floor.
 */

/** Fields the poll-loop harness (`runWorkerLoop`) reads. Every worker has these. */
export type WorkerLoopTunables = {
  /** Sleep when a cycle found no work, before polling again (ms). */
  loopIdleMs: number;
  /** Sleep after a loop-level throw, before the next cycle (ms). */
  errorSleepMs: number;
  /** Optional ±ratio applied to the idle sleep to avoid thundering herds. */
  jitterPct?: number;
  /**
   * Worker-specific extras (retention windows, HTTP timeouts, channel
   * throttles, …) are allowed — the index signature keeps `satisfies` from
   * rejecting them while still requiring the fields above.
   */
  [k: string]: unknown;
};

/** Extra fields the `JobQueueRunner` reads, on top of the loop tunables. */
export type JobQueueTunables = WorkerLoopTunables & {
  /** Rows to claim per cycle. */
  claimBatchSize: number;
  /** PROCESSING lease before the maintenance worker reclaims a stuck row (ms). */
  processingLeaseMs: number;
  /**
   * Wall-clock deadline for one `execute` (ms). A hung external call otherwise
   * freezes the ENTIRE worker forever (the tick's `Promise.all` never settles,
   * no new claims, process stays RUNNING and looks healthy) — `maxAttemptsPerJob`
   * never engages because a hang never becomes a failure. The runner races
   * `execute` against this; timing out throws a retryable error, so the normal
   * attempts/backoff machinery takes over. MUST be < `processingLeaseMs`, so the
   * runner times the job out (and reschedules it itself) before the maintenance
   * requeue creates a concurrent duplicate.
   */
  jobTimeoutMs: number;
  /** Attempts before a transient failure becomes a terminal FAILED. */
  maxAttemptsPerJob: number;
  /** Exponential-backoff base + cap for transient reschedules (ms). */
  backoffBaseMs: number;
  backoffCapMs: number;
  /** Jitter ratio for backoff + idle (required for queue workers). */
  jitterPct: number;
  /**
   * Max jobs processed in parallel per cycle. Omit to process the whole claimed
   * batch at once (notifications).
   */
  concurrency?: number;
};
