import type { Request } from "express";
import { ZodError } from "zod";
import { envVariables } from "../../../environment/envVariables.js";

/**
 * Structured error logging for the API's central error handler (and 404s).
 *
 * HARD RULE — no query-string values in logs (E086/E087). Request URLs carry
 * real credentials in the query: the email-unsubscribe token (deliberately
 * never expires, deterministic per recipient) and the onboarding
 * `registrationToken` (no expiry, ends in a session JWT). A log line is
 * permanent, so `baseFromReq` strips the query and logs the path only, and
 * headers go through an allow-list. Never add a log site that prints
 * `req.originalUrl`/`req.url` with its query attached — the only other URL
 * logger is `morgan("dev")` in app.ts, which by decision (2026-08-02) runs in
 * dev/staging only (team-only environments), never in production.
 */

// Minimal scrubber for sensitive headers (add/remove as needed)
const pickSafeHeaders = (req: Request) => {
  const h = req.headers || {};
  const allow = ["user-agent", "accept", "content-type", "x-request-id"];
  const safe: Record<string, unknown> = {};
  for (const k of allow) {
    if (h[k]) safe[k] = h[k];
  }
  return safe;
};

type LogBase = {
  timestamp: string;
  env: string | undefined;
  method: string | undefined;
  url: string | undefined;
  path: string | undefined;
  status: number;
  requestId?: string | string[];
  ip?: string | undefined;
  headers?: Record<string, unknown>;
};

const baseFromReq = (req: Request, status: number): LogBase => ({
  timestamp: new Date().toISOString(),
  env: envVariables.APP_STAGE,
  method: req?.method,
  // Never log the query string: request URLs carry credentials there (the
  // never-expiring email-unsubscribe token, the onboarding registrationToken),
  // and an error log line is permanent. Path only — no query values, ever.
  url: ((req as any)?.originalUrl ?? req?.url)?.split("?")[0],
  path: (req as any)?.path,
  status,
  requestId: req?.headers?.["x-request-id"] as any,
  ip: req?.ip,
  headers: pickSafeHeaders(req),
});

export const logError = (req: Request, err: any, status: number) => {
  const base = baseFromReq(req, status);

  // Zod validation errors
  if (err instanceof ZodError) {
    const payload = {
      type: "ZOD",
      ...base,
      errors: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };

    console.error(JSON.stringify(payload));
    return;
  }

  // Your CustomError shape: { status, error: { code, message }, errors? }
  if (err && err.error) {
    const payload = {
      type: "CUSTOM",
      ...base,
      error: err.error, // includes code/message/(optional) errors
      ...(Array.isArray(err.error?.errors) ? { errors: err.error.errors } : {}),
    };

    console.error(JSON.stringify(payload));
    return;
  }

  // Unknown/internal errors
  const payload = {
    type: "INTERNAL",
    ...base,
    name: err?.name,
    message: err?.message ?? String(err),
  };

  console.error(JSON.stringify(payload));
};
