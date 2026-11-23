import { isCustomError } from "../../utils/core/errors/createCustomError.js";

/**
 * Worker error classification — the flag-readers the runtime (`runJobQueue`,
 * `reportWorkerError`) uses to decide retry-vs-terminal and report-vs-mute.
 *
 * There is **one error type across the whole repo**: workers throw the same
 * `createCustomError` the API does, with the worker-relevant flags —
 * `createCustomError(code, msg, { permanent: true })` to fail a job terminally,
 * `{ permanent: true, expected: true }` for a benign terminal that the tracker
 * should ignore. Codes live in the 8xxx worker-failure block (raw literals at
 * the throw site, like every other domain code). There are no dedicated worker
 * error classes — classification is purely off the `.permanent` / `.expected`
 * flags below.
 *
 * Default (any plain, non-`CustomError` throw): **retryable** — the runner
 * reschedules with backoff until `maxAttemptsPerJob`, then fails terminally.
 * That safe default is what handles the unstructured errors workers throw from
 * everywhere (IG/Stripe/Prisma/null-deref); you only set `permanent` when you
 * actually KNOW the job can't recover.
 */

/** True when the runner must stop retrying immediately (a permanent failure). */
export function isTerminalError(err: unknown): boolean {
  return isCustomError(err) && err.permanent === true;
}

/** True for benign/operational errors the tracker should NOT capture. */
export function isExpectedError(err: unknown): boolean {
  return isCustomError(err) && err.expected === true;
}
