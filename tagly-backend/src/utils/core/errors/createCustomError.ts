import type { ApiError, ApiZodIssue, ErrorCode } from "@tagly/models/shared";

export type CustomError = Error & {
  status: number;
  error: ApiError["error"];
  /**
   * Worker retry axis: when true, the job runner fails the job terminally
   * instead of retrying. Meaningless on the HTTP boundary (there is no retry) —
   * read only by `runJobQueue`/`runWorkerLoop`. The API boundary reads `status`.
   */
  permanent?: boolean;
  /**
   * Mute flag for the `reportError` sink: when true the error is NOT tracked.
   * Use for a benign ≥500 (API) or a benign worker terminal outcome that we
   * don't want paging us. Operational errors (status <500, Zod) are muted by the
   * boundary regardless of this flag.
   */
  expected?: boolean;
  /**
   * Escalate this error: on top of tracking, `reportError` also emails the team
   * (deduped). Use ONLY for genuine "shouldn't happen, a human must act" errors
   * (money-integrity / invariant violations) — not routine failures.
   */
  notify?: boolean;
  /**
   * Dedupe key for the `notify` email — scope it per entity (e.g. the Stripe
   * payment-intent / refund / withdrawal id) so distinct incidents each alert
   * while webhook retries of the SAME one don't spam. Falls back to
   * `service:code:throw_site` (per error-type) when unset.
   */
  notifyKey?: string;
};

/**
 * Options form of `createCustomError`. Every field is optional so a WORKER error
 * (no HTTP status) and an API error (status, no retry axis) share one factory:
 * each boundary reads the field relevant to its action.
 */
export type CustomErrorOptions = {
  /** HTTP status the API boundary returns. Defaults to 500 when omitted. */
  status?: number;
  /** Worker: fail terminally instead of retrying. */
  permanent?: boolean;
  /** Mute the tracker for this error. */
  expected?: boolean;
  /** Zod issue list, surfaced on validation errors. */
  errors?: ApiZodIssue[];
  /**
   * Underlying root-cause error, attached for the tracker only — it rides to
   * PostHog (via `reportError`) but is NEVER copied into the client-facing
   * `error.message`. Set it when you catch a low-level throw (Prisma/Stripe/…)
   * and rethrow a generic domain error, so the tracker shows the real cause
   * instead of just the generic message.
   */
  cause?: unknown;
  /**
   * Escalate: `reportError` emails the team (deduped) in addition to tracking.
   * ONLY for genuine "shouldn't happen, a human must act" errors.
   */
  notify?: boolean;
  /** Per-entity dedupe key for the notify email (see `CustomError.notifyKey`). */
  notifyKey?: string;
};

// Legacy positional form — `status` as the 3rd arg (+ optional `errors` 4th).
// Kept so every existing controller call site (`createCustomError(code, msg,
// 404)`) works untouched.
export function createCustomError(
  code: ErrorCode,
  message: string,
  status: number,
  errors?: ApiZodIssue[]
): CustomError;
// New unified options form — `status` optional (workers have no HTTP status);
// carries the `permanent` / `expected` flags.
export function createCustomError(
  code: ErrorCode,
  message: string,
  opts?: CustomErrorOptions
): CustomError;
export function createCustomError(
  code: ErrorCode,
  message: string,
  statusOrOpts?: number | CustomErrorOptions,
  legacyErrors?: ApiZodIssue[]
): CustomError {
  // Overload resolution: a number 3rd arg is the legacy positional status; an
  // object is the new options bag.
  const opts: CustomErrorOptions =
    typeof statusOrOpts === "number"
      ? { status: statusOrOpts, errors: legacyErrors }
      : statusOrOpts ?? {};

  const e = new Error(message) as CustomError;
  e.status = opts.status ?? 500;
  e.error = { code, message, ...(opts.errors ? { errors: opts.errors } : {}) };
  if (opts.permanent) e.permanent = true;
  if (opts.expected) e.expected = true;
  if (opts.notify) e.notify = true;
  if (opts.notifyKey) e.notifyKey = opts.notifyKey;
  // Cast keeps this valid regardless of the compiled lib target. `error.message`
  // above stays clean, so the client never sees the underlying cause.
  if (opts.cause !== undefined)
    (e as Error & { cause?: unknown }).cause = opts.cause;
  return e;
}

export function isCustomError(err: unknown): err is CustomError {
  return !!err && typeof err === "object" && "error" in (err as any);
}
