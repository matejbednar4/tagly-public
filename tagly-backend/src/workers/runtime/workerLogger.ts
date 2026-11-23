import { envVariables } from "../../environment/envVariables.js";

/**
 * Request-less structured logger for workers.
 *
 * The existing `utils/core/errors/logError.ts` is Express-`Request`-bound,
 * so workers (which have no request) can't use it. This mirrors its convention —
 * one JSON object per line to stdout/stderr — but keyed on a `worker` tag plus
 * whatever structured context each call passes (jobId, shareId, attempts,
 * durationMs, outcome, …). Replaces the ~114 ad-hoc `console.*` calls with one
 * consistent, greppable shape.
 */

export type LogContext = Record<string, unknown> & { err?: unknown };

export type WorkerLogger = {
  info: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  error: (msg: string, ctx?: LogContext) => void;
  /** Child logger that merges `base` fields into every subsequent line. */
  child: (base: LogContext) => WorkerLogger;
};

const serializeErr = (e: unknown) => {
  if (e == null) return undefined;
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { message: String(e) };
};

function emit(
  level: "info" | "warn" | "error",
  worker: string,
  base: LogContext,
  msg: string,
  ctx?: LogContext,
) {
  const { err, ...rest } = { ...base, ...ctx };
  const line = {
    timestamp: new Date().toISOString(),
    level,
    env: envVariables.APP_STAGE,
    worker,
    msg,
    ...rest,
    ...(err !== undefined ? { err: serializeErr(err) } : {}),
  };
  const out =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  out(JSON.stringify(line));
}

export function workerLogger(
  worker: string,
  base: LogContext = {},
): WorkerLogger {
  return {
    info: (msg, ctx) => emit("info", worker, base, msg, ctx),
    warn: (msg, ctx) => emit("warn", worker, base, msg, ctx),
    error: (msg, ctx) => emit("error", worker, base, msg, ctx),
    child: (extra) => workerLogger(worker, { ...base, ...extra }),
  };
}
