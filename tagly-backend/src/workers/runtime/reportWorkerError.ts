import { workerLogger } from "./workerLogger.js";
import { isExpectedError } from "./workerErrors.js";
import {
  reportError,
  type ErrorClass,
} from "../../utils/core/errors/reportError.js";

/**
 * The single chokepoint for UNEXPECTED worker failures — loop crashes, terminal
 * job failures, and process-level crashes. Every worker reports through here, so
 * there is exactly one place that feeds the shared `reportError` sink.
 *
 * It keeps the structured stderr log line (the surrounding-context narrative)
 * AND forwards to `reportError` (PostHog). Classification is **opt-OUT**,
 * mirroring the API boundary: everything reaching here is captured EXCEPT errors
 * flagged `expected` (a `createCustomError(..., { expected: true })`) — so the
 * scary unforeseen throws are never silently dropped.
 *
 * The `errorClass` breakdown is derived from the context the runtime already
 * knows at the point it gives up: `fatal` (a process crash) → `crash`;
 * `permanent` (a `{ permanent: true }` error) → `permanent`; otherwise (exhausted
 * retries / a recoverable loop error) → `transient`.
 */

export type WorkerErrorPhase = "loop" | "job" | "task" | "process";

export type WorkerErrorContext = {
  worker: string;
  /** Where in the worker the error surfaced. */
  phase: WorkerErrorPhase;
  jobId?: number;
  shareId?: number;
  /** Attempt number, when a job died after exhausting retries. */
  attempts?: number;
  /** True when the error was a permanent-flagged error (vs exhausted retries). */
  permanent?: boolean;
  /** True for a process-level crash (uncaughtException / unhandledRejection). */
  fatal?: boolean;
  /** Any extra structured context. */
  [k: string]: unknown;
};

const log = workerLogger("worker");

export function reportWorkerError(err: unknown, ctx: WorkerErrorContext) {
  // Opt-out: benign/operational errors are not tracked.
  if (isExpectedError(err)) return;

  log.error("worker error", { ...ctx, err });

  const errorClass: ErrorClass = ctx.fatal
    ? "crash"
    : ctx.permanent
    ? "permanent"
    : "transient";

  // ctx already carries worker/phase/jobId/… — spread it, then set the sink
  // fields. `service` = the worker name so it becomes the sub-stream.
  reportError(err, {
    ...ctx,
    source: "worker",
    errorClass,
    service: ctx.worker,
  });
}
