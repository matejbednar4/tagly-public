import { runWorkerLoop } from "./runWorkerLoop.js";
import { reportWorkerError } from "./reportWorkerError.js";
import { isTerminalError } from "./workerErrors.js";
import {
  makeJobTransitions,
  claimDueJobs,
  type JobQueueDelegate,
  type ClaimContext,
} from "./jobQueue.js";
import type { WorkerLogger } from "./workerLogger.js";
import { jitter } from "../helpers/jitter.js";
import { sampleIds } from "../helpers/sampleIds.js";
import type { JobQueueTunables } from "../../constants/workers/types.js";

/** Exponential retry backoff (ms) for the given attempt, capped at `cap`.
 *  Exported for tunables verification (schedule math must be checked against
 *  the real formula, not a re-derivation). */
export function expBackoffMs(attempt: number, base: number, cap: number) {
  return Math.floor(Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1))));
}

export type TerminalFailureInfo = {
  err: unknown;
  attempts: number;
  /** True when the error was permanent-flagged (vs exhausted retries). */
  permanent: boolean;
};

/**
 * Sentinel an `execute` may RETURN (not throw) to voluntarily put the job back
 * to SCHEDULED at `until` — "not now, later" (e.g. a promo send re-snapped
 * into the recipient's quiet-hours window, or an email waterfall leg waiting
 * for its push sibling). Unlike a thrown transient error, a deferral does not
 * consume a retry attempt and is not an error.
 */
export class DeferJob {
  constructor(readonly until: Date) {}
}

/**
 * The two lifecycle columns the runner reads off every claimed job (present and
 * identically named on all `jobs.*Queue` rows). `attempts` is already
 * incremented at claim time, so it counts the current run.
 */
export type JobRow = { id: number; attempts: number };

export type JobQueueConfig<J extends JobRow> = {
  /** Stable worker name (log tag + reportError context). */
  name: string;
  tunables: JobQueueTunables;
  /**
   * The Prisma delegate for this worker's `jobs.*Queue` table. The runner
   * derives the lifecycle writes (markDone/failJob/reschedule) AND the default
   * FIFO claim from it — the worker never wires those by hand.
   */
  table: JobQueueDelegate;
  /**
   * Columns/relations to hydrate on each claimed job. Drives the default
   * (oldest-due-first) claim. Required unless a custom `claim` is given.
   */
  select?: Record<string, unknown>;
  /**
   * Override the default claim with a custom strategy (e.g. insights'
   * two-phase, expiring-stories-first claim). Gets the table via its ctx.
   */
  claim?: (ctx: ClaimContext) => Promise<J[]>;
  /**
   * Run one job; resolve on success (return value ignored — EXCEPT a returned
   * `DeferJob`, which puts the job back to SCHEDULED at its `until` without
   * consuming an attempt), throw to retry, throw
   * `createCustomError(code, msg, { permanent: true })` to fail now.
   */
  execute: (job: J) => Promise<unknown>;
  /** Called once when a job fails terminally (permanent OR max attempts) — e.g. void the share. */
  onTerminalFailure?: (job: J, info: TerminalFailureInfo) => Promise<void>;
  /** Extra structured log/report context per job (e.g. `{ shareId }`). */
  jobLogContext?: (job: J) => Record<string, unknown>;
  /**
   * Advisory-lock key (`LOCK_KEYS.*`) to run this queue worker single-flight —
   * forwarded to `runWorkerLoop`. Use when per-job idempotency is not enough
   * (e.g. notifications: transactional PUSH has no delivery-side dedup, so the
   * ECS deploy overlap would double-send).
   */
  singleton?: bigint;
};

/**
 * The one runner for every enqueued-job worker. Owns the whole queue mechanism:
 * claim → execute → markDone, with transient errors rescheduled on jittered
 * exponential backoff until `maxAttemptsPerJob`, then failed terminally.
 * A `{ permanent: true }` error fails immediately. Terminal failures fire
 * `onTerminalFailure` and report through the single `reportWorkerError`
 * chokepoint. Runs on top of `runWorkerLoop`, so graceful shutdown, idle pacing,
 * and loop-error backoff are shared with every other worker.
 *
 * Each worker supplies only its claim, execute, and (optionally) a terminal-
 * failure side effect — no copy-pasted loop, retry block, or update helpers.
 */
export function runJobQueue<J extends JobRow>(
  config: JobQueueConfig<J>,
): Promise<void> {
  const {
    name,
    tunables: T,
    table,
    select,
    execute,
    onTerminalFailure,
    jobLogContext,
  } = config;

  if (!config.claim && !select) {
    throw new Error(
      `[${name}] runJobQueue needs either a \`select\` (default claim) or a custom \`claim\``,
    );
  }

  // Lifecycle writes + default claim are both derived from the table.
  const transitions = makeJobTransitions(table);
  const claim =
    config.claim ??
    ((ctx: ClaimContext) =>
      claimDueJobs<J>(ctx.table, {
        now: ctx.now,
        batchSize: ctx.batchSize,
        leaseMs: ctx.leaseMs,
        where: { scheduledAt: { lte: ctx.now } },
        orderBy: { scheduledAt: "asc" },
        select: select!,
      }));

  const ctxOf = (job: J) => jobLogContext?.(job) ?? {};

  const processOne = async (job: J, log: WorkerLogger) => {
    const id = job.id;
    const jlog = log.child({ jobId: id, ...ctxOf(job) });
    const t0 = Date.now();

    // Wall-clock deadline around `execute`. Without it, one hung external call
    // (an un-timed-out HTTP request, a stuck socket) freezes the ENTIRE worker:
    // the tick's Promise.all never settles, no new jobs are claimed, and the
    // process stays RUNNING so nothing alerts. `maxAttemptsPerJob` cannot help
    // — a hang never becomes a failure. Racing converts the hang into a
    // retryable throw, handing control to the normal attempts/backoff
    // machinery. Known cost: the timed-out execute keeps running detached and
    // its late writes may race the rescheduled run — the same window the
    // lease-expiry requeue already has, and strictly better than a dead worker.
    let deadline: NodeJS.Timeout | undefined;
    const executeWithDeadline = () =>
      Promise.race([
        execute(job),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () =>
              reject(
                new Error(
                  `job execution exceeded jobTimeoutMs (${T.jobTimeoutMs}ms)`,
                ),
              ),
            T.jobTimeoutMs,
          );
        }),
      ]);

    try {
      const outcome = await executeWithDeadline();
      if (outcome instanceof DeferJob) {
        await transitions.deferJob(id, outcome.until);
        jlog.info("job deferred", {
          durationMs: Date.now() - t0,
          until: outcome.until.toISOString(),
        });
        return;
      }
      await transitions.markDone(id);
      jlog.info("job done", { durationMs: Date.now() - t0 });
    } catch (err) {
      // Flag-based (unified with the API error): a permanent CustomError —
      // `createCustomError(code, msg, { permanent: true })`.
      const permanent = isTerminalError(err);
      // `attempts` was incremented at claim time, so it already counts this run.
      const attempts = job.attempts;

      if (permanent || attempts >= T.maxAttemptsPerJob) {
        // Terminal-failure ordering: run the side effect (e.g. void the share
        // + release its budget lock) BEFORE stamping the job FAILED. The two
        // writes are not atomic, but this order makes every crash state
        // converge: a crash after the void leaves the job PROCESSING → lease
        // expiry → requeue → terminal again → the void no-ops (its
        // PROCESSING-guarded CAS) → FAILED stamps. The old order (FAILED
        // first) left a share PROCESSING with its lock held and matching zero
        // recovery predicates. If the hook THROWS, we deliberately do NOT
        // stamp FAILED (that would recreate the stranding) — the job stays
        // PROCESSING and the requeue retries the whole terminal path. The
        // `voidSharesWithFailedJobs` maintenance sweep is the backstop for
        // rows stranded under the old ordering.
        try {
          if (onTerminalFailure) {
            await onTerminalFailure(job, { err, attempts, permanent });
          }
          await transitions.failJob(id, err);
        } catch (hookErr) {
          // Contained here so one job's failing hook doesn't blow up the whole
          // tick. The job stays PROCESSING → requeued → terminal path retried.
          reportWorkerError(hookErr, {
            worker: name,
            phase: "job",
            jobId: id,
            attempts,
            note: "terminal-failure handling itself failed; job left PROCESSING for requeue",
            ...ctxOf(job),
          });
        } finally {
          // Always report the job's own terminal error — previously a throwing
          // hook skipped this and the stranding was created silently.
          reportWorkerError(err, {
            worker: name,
            phase: "job",
            jobId: id,
            attempts,
            permanent,
            ...ctxOf(job),
          });
        }
        return;
      }

      const delay = jitter(
        expBackoffMs(attempts, T.backoffBaseMs, T.backoffCapMs),
        T.jitterPct,
      );
      const nextAt = new Date(Date.now() + delay);
      await transitions.reschedule(id, nextAt);
      jlog.warn("job rescheduled", {
        attempts,
        delayMs: Math.round(delay),
        nextAt: nextAt.toISOString(),
      });
    } finally {
      clearTimeout(deadline);
    }
  };

  return runWorkerLoop({
    name,
    tunables: T,
    singleton: config.singleton,
    tick: async ({ log }) => {
      const now = new Date();
      // Claim ONLY what this tick will actually execute. The claim is a
      // state-changing CAS — it flips every scanned row SCHEDULED → PROCESSING,
      // stamps the lease, and increments `attempts` — so claiming more than we
      // run stranded the surplus: invisible to the next tick (every claim path
      // filters `status: "SCHEDULED"`), never executed, and already charged an
      // attempt. Those rows then depended on the maintenance requeue, which for
      // a story job inside its ~30 min `validUntil` window often arrived after
      // expiry, handing the share straight to `expireInsightsJobs` — and each
      // wasted claim burned a retry, so the first genuine transient error on the
      // first real execution went straight to the terminal path and voided a
      // payable share.
      //
      // Throughput is unchanged: `concurrency` still bounds parallel execution,
      // and the tick returns `true` to spin and drain a backlog. Only the number
      // of claim round-trips goes up. Workers without `concurrency`
      // (notifications) keep claiming and running the full batch.
      const batchSize = T.concurrency
        ? Math.min(T.claimBatchSize, T.concurrency)
        : T.claimBatchSize;

      const jobs = await claim({
        now,
        batchSize,
        leaseMs: T.processingLeaseMs,
        table,
      });
      if (jobs.length === 0) return false;

      log.info("claimed jobs", {
        count: jobs.length,
        ids: sampleIds(jobs.map((j) => j.id)),
      });

      await Promise.all(jobs.map((job) => processOne(job, log)));

      return true; // spin to drain the backlog
    },
  });
}
