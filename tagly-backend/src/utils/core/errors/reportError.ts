import { envVariables } from "../../../environment/envVariables.js";
import { getPostHog } from "../../clients/posthog.js";
import { sendTeamAlertEmail } from "../../email/sendTeamAlertEmail.js";
import type { CustomError } from "./createCustomError.js";

/**
 * The single error-tracking sink for the whole backend — the API request path
 * AND the worker fleet both funnel here. It is a pure recorder: the boundaries
 * (`middleware/request/errors.ts` for the API, `workers/runtime/reportWorkerError.ts`
 * for workers, plus the process-level crash handlers) decide *whether* an error
 * is worth reporting; `reportError` only enriches + ships it to PostHog.
 *
 * PostHog is the single store for backend errors (no parallel DB table — it
 * already retains/dedupes/alerts, and duplicating every stack trace into the
 * primary Postgres would just amplify writes on the DB that serves the ledger).
 * Same project as the client analytics; a global `app: "backend"` super-property
 * (mirroring the clients' `app: "customer"`/`"advertiser"`) keeps it apart, and
 * `app_env` stamps the stage. Anonymous like the clients: `distinctId` = the
 * acting entity's uid when we have one, else "backend".
 *
 * Fail-open: a tracking failure must never affect the request/job (the send is
 * wrapped). The vendor is named only in `clients/posthog.ts`; the flush on
 * shutdown is `shutdownPostHog`, imported straight from there (like
 * `shutdownRedis`/`shutdownDb`).
 */

/**
 * - `api` / `worker` — reported by the two request/job boundaries.
 * - `system` — a background side-effect that isn't owned by a request or a
 *   worker tick (e.g. a best-effort notification-queue write that failed and was
 *   swallowed to protect the caller). These would otherwise be invisible, so
 *   they report directly rather than through a boundary.
 */
export type ErrorSource = "api" | "worker" | "system";

/**
 * The one breakdown dimension, uniform across both runtimes:
 * - `unexpected` — an unforeseen throw / ≥500 at the API boundary (a bug; investigate).
 * - `domain`     — a deliberate API domain rejection (≥1000 code, usually 4xx, e.g. "share creation
 *                  failed"). Not a bug — tracked so we can SEE how often users hit it.
 * - `permanent`  — a permanent-flagged worker error (deterministic; won't self-heal).
 * - `transient`  — a worker error that exhausted retries / a recoverable loop error (environmental; watch rate).
 * - `crash`      — a process-level `uncaughtException`/`unhandledRejection` (fatal; the process fell over).
 */
export type ErrorClass =
  | "unexpected"
  | "domain"
  | "permanent"
  | "transient"
  | "crash";

export type ReportErrorContext = {
  source: ErrorSource;
  errorClass: ErrorClass;
  /** "api" or the worker name — the sub-stream within `app: "backend"`. */
  service?: string;
  /** PostHog distinct id — the acting entity uid when known, else "backend". */
  distinctId?: string;
  /** Domain error code, when the error carried one. */
  code?: number;
  /**
   * Escalate: also email the team (deduped) on top of tracking. Defaults to the
   * error's own `notify` flag (`createCustomError(..., { notify: true })`), so a
   * boundary needn't special-case it; pass `true` here for a detect-and-continue
   * anomaly that isn't a thrown CustomError. ONLY for "a human must act" cases.
   */
  notify?: boolean;
  /**
   * Dedupe key for the notify email. Scope per (callsite + entity) so a recurring
   * anomaly alerts once per window. Defaults to `service:code:throw_site`.
   */
  notifyKey?: string;
  /**
   * Extra lines appended to the notify email body — context a human needs to
   * act (what happened, what automation already did, what to reconcile). Only
   * used when the error notifies; the PostHog capture carries the structured
   * ctx either way.
   */
  notifyLines?: string[];
  /** Any other structured context (status, method, path, worker, phase, jobId, shareId, uids, …). */
  [k: string]: unknown;
};

// Frames belonging to the error-infrastructure itself — skipped so the reported
// throw site is the real caller, not the factory that built the Error.
const INFRA_FRAME =
  /(createCustomError|reportError|logError|request\/errors|runJobQueue|runWorkerLoop|reportWorkerError|workerErrors|asyncHandler)\.(?:ts|js)/;
// Matches a compiled or source frame: ".../src/foo.ts:12" or ".../dist/foo.js:12".
const FRAME = /\/((?:src|dist)\/[^\s():]+\.(?:ts|js)):(\d+)/;

/**
 * Best-effort throw-site extraction (the "log where the backend throws" signal,
 * v2.0.0.md §7). `createCustomError` builds a real `Error`, so its stack points
 * at the throw site; we skip our own infra frames and return the first app frame
 * as `path:line`.
 */
function extractThrowSite(err: Error): string | undefined {
  if (!err.stack) return undefined;
  const frames = err.stack.split("\n").slice(1);
  const pick = (skipInfra: boolean) => {
    for (const f of frames) {
      if (skipInfra && INFRA_FRAME.test(f)) continue;
      const m = f.match(FRAME);
      if (m) return `${m[1]}:${m[2]}`;
    }
    return undefined;
  };
  return pick(true) ?? pick(false);
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

/** JSON-safe copy so a stray non-serializable value can't break the send. */
function toJsonSafe(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
}

/**
 * Record an unexpected error to PostHog. Never throws — the send is wrapped
 * fail-open, so a boundary can call this unconditionally after deciding the
 * error is worth tracking.
 */
export function reportError(err: unknown, ctx: ReportErrorContext): void {
  const {
    source,
    errorClass,
    service,
    distinctId,
    code,
    notify,
    notifyKey,
    notifyLines,
    ...rest
  } = ctx;
  const e = toError(err);
  const svc = service ?? source;
  const throwSite = extractThrowSite(e);

  // Root cause attached via `createCustomError(..., { cause })` — surfaced as its
  // own property so it's visible even if the tracker doesn't walk `Error.cause`.
  const rawCause = (e as Error & { cause?: unknown }).cause;
  const cause =
    rawCause instanceof Error
      ? rawCause.message
      : rawCause != null
      ? String(rawCause)
      : undefined;

  try {
    getPostHog().captureException(e, distinctId ?? "backend", {
      app: "backend",
      app_env: envVariables.APP_STAGE,
      service: svc,
      error_source: source,
      error_class: errorClass,
      error_code: code,
      throw_site: throwSite,
      // Person-less, matching captureServerEvent and the clients' anonymous
      // posture — the uid distinctId stays for correlation, no person profile.
      $process_person_profile: false,
      cause,
      ...toJsonSafe(rest),
    });
  } catch {
    // never let tracking throw into the caller
  }

  // Escalation: email the team on top of tracking. Honors either an explicit
  // `notify` in ctx or the error's own `notify` flag. Fire-and-forget + deduped
  // (per key, cross-instance) so it never blocks or storms the caller.
  const shouldNotify = notify === true || (e as CustomError).notify === true;
  if (shouldNotify) {
    // Per-entity dedupe key: ctx wins, else the error's own `notifyKey`, else a
    // per-error-type fallback (`service:code:throw_site`).
    const key =
      notifyKey ??
      (e as CustomError).notifyKey ??
      `notify:${svc}:${code ?? "na"}:${throwSite ?? "na"}`;
    void sendTeamAlertEmail({
      subject: `[${envVariables.APP_STAGE}] ${svc}: ${e.message}`,
      lines: [
        e.message,
        throwSite ? `Throw site: ${throwSite}` : "",
        cause ? `Cause: ${cause}` : "",
        code != null ? `Error code: ${code}` : "",
        ...(notifyLines ?? []),
      ].filter(Boolean),
      dedupeKey: key,
    }).catch(() => {
      // best-effort — sendTeamAlertEmail already swallows its own failures
    });
  }
}
