/**
 * Tunables for the maintenance worker.
 * Controls how often maintenance runs, batch sizes, and recovery operations.
 */
import type { WorkerLoopTunables } from "./types.js";

export const jobMaintenanceTunables = {
  // Single idle for both "another instance holds the lock" and "finished a
  // cycle"; the harness sleeps this when the singleton lock isn't held and after
  // each cycle.
  //
  // 15 min → 5 min: this cycle carries `requeueStuckJobs`, the only actor that
  // rescues a job whose worker died mid-flight. A STORY insights job has just a
  // 30 min window between its schedule and `validUntil`
  // (`STORY_INSIGHTS_SCHEDULE`), and `expireInsightsJobs` runs in this same
  // cycle immediately after the requeue — so at 15 min a stranded job could
  // reach the expiry sweep before the rescue sweep and have its share voided.
  // At 5 min the requeue gets ~6 chances inside the window.
  loopIdleMs: 5 * 60 * 1000, // 5 min
  errorSleepMs: 1_000, // 1 sec - sleep after loop-level error
  fetchBatchSize: 500, // fetch batch size
  // How far back the visibility reconciler looks when attributing a
  // visible → not-visible transition to a recent PAYG period close (card
  // removed / charge failed). Older closes fall through to the generic cause.
  visibilityCauseWindowMs: 48 * 60 * 60 * 1000, // 48 h
} as const satisfies WorkerLoopTunables;
