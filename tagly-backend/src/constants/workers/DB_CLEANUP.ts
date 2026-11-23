/**
 * Tunables for the database cleanup worker.
 * Controls how often cleanup runs and retention periods for various record types.
 */
import type { WorkerLoopTunables } from "./types.js";

export const dbCleanupTunables = {
  loopIdleMs: 15 * 60 * 1000, // 15 min - sleep between cycles
  errorSleepMs: 5_000, // 5 sec - sleep after loop-level error
  batchSize: 500, // ids per delete batch
  maxBatchesPerCycle: 10, // safety cap per cycle per rule
  dryRun: false, // false doesnt delete, true does

  // -- when to delete what
  keepFinishedIgJobsMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  keepFinishedNotificationJobsMs: 24 * 60 * 60 * 1000, // 24 hours
  keepPendingMediaMs: 24 * 60 * 60 * 1000, // 24 hours
  // Abandoned create-local drafts / crashed confirms. A real confirm takes
  // seconds, so a day-old pending local is always abandoned.
  keepAbandonedPendingLocalsMs: 24 * 60 * 60 * 1000, // 24 hours

  // Advertiser-deleted business pages (status DELETED). The grace window is a
  // support/undo buffer before the hard purge; the purge additionally waits for
  // every in-flight share to settle so customers still get paid.
  keepDeletedLocalsMs: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Abandoned registrations (PendingCustomer / PendingAdvertiserAccount).
  // Completion deletes the pending row, so anything this old is an abandoned
  // signup holding personal data with no account — privacy retention policy.
  keepAbandonedSignupsMs: 30 * 24 * 60 * 60 * 1000, // 30 days

  // Stripe webhook dedupe rows — only needed to absorb replays (Stripe's own
  // retries span days); prevents unbounded growth of stripe_events.
  keepStripeEventsMs: 90 * 24 * 60 * 60 * 1000, // 90 days

  keepExpiredOtpSessionsMs: 15 * 60 * 1000, // 15 minutes after expiry
  keepBlockedOtpSessionsMs: 15 * 60 * 1000, // 15 minutes after blocked
} as const satisfies WorkerLoopTunables;
