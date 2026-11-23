/**
 * Tunables for the notifications worker.
 *
 * Controls job claiming, retry logic, throttling, and preference enforcement
 * for sending email and push notifications.
 */
import type { JobQueueTunables } from "./types.js";

export const notificationsWorkerTunables = {
  claimBatchSize: 64,
  /**
   * Bounds parallel provider calls (the runner claims and runs
   * min(claimBatchSize, concurrency) per tick). Without it, a due backlog
   * fired 64 concurrent Resend/Expo calls per tick with no global limit —
   * the E057 burst. 8 keeps throughput ample (the email leg is paced by
   * `acquireEmailSendBudget` anyway) while capping the instantaneous burst.
   */
  concurrency: 8,
  processingLeaseMs: 60 * 1000, // 1 minute lease before maintenance reclaims

  /**
   * Per-job wall-clock deadline (45 s < the 60 s lease). Covers the Resend send
   * (15 s cap in `sendEmail`), the push send (its own AbortController timeout),
   * and in-process throttle waits under a full 64-job batch.
   */
  jobTimeoutMs: 45 * 1000,
  loopIdleMs: 5_000, // 5 seconds idle when no jobs
  errorSleepMs: 1_000, // 1 second sleep after loop-level error

  // Retry/backoff (transient errors only). Sized so the schedule OUTLIVES a
  // real provider incident (E073): delays are 1m → 2m → 4m → 8m → 10m → 10m
  // → 10m (the cap binds from attempt 5), ≈45 minutes of wall clock before a
  // job fails terminally. The old 15s base / 4 attempts burned out in ~105s,
  // so any Resend/Expo outage longer than ~2 minutes terminally dropped every
  // in-flight notification — including payout confirmations and mandatory
  // ban/security mail — with no dead letter (FAILED rows are deleted by
  // cleanup after 24h; only the PostHog terminal event remains — see
  // `jobLogContext` in run.ts, which stamps notificationType for alerting).
  backoffBaseMs: 60_000, // 1 minute base
  backoffCapMs: 10 * 60_000, // 10 minutes max (binds from attempt 5)

  httpTimeoutMs: 8 * 1000, // 8 seconds
  maxBodySizeBytes: 256 * 1024, // 256 KB

  // Observability / guardrails
  maxAttemptsPerJob: 8,

  // Preference double-check at send time (defense-in-depth)
  enforcePreferencesAtSend: true,

  // Channel-specific throttles (optional)
  email: {
    throttlePerRecipient: true,
    perRecipientRps: 0.5, // 1 mail / 2s per recipient
  },
  push: {
    throttlePerToken: true,
    perTokenRps: 1, // ~1 push / sec / token
  },

  jitterPct: 0.2,
} as const satisfies JobQueueTunables;
