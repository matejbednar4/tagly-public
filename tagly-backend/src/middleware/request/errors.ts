import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import {
  createCustomError,
  isCustomError,
} from "../../utils/core/errors/createCustomError.js";
import { logError } from "../../utils/core/errors/logError.js";
import { reportError } from "../../utils/core/errors/reportError.js";
import { getEntityFromUid } from "../../utils/core/uids/getEntityFromUid.js";
import { ERROR_CODES } from "@tagly/models/shared";
import type { Request } from "express";

/**
 * Track an API error. Opt-OUT model (v2.0.0.md §5): **capture everything** so we
 * can see how often things fail — every ≥500 (incl. an unforeseen Prisma/Stripe
 * throw) AND every domain rejection (e.g. "share creation failed", a 4xx that's
 * real product signal). The **only** thing skipped is `expected: true`, which the
 * handful of pure transport/session edge cases set at their own throw site (Zod,
 * auth, rate-limit, route-not-found, client-outdated, OTP) — they fire constantly
 * from bots/expired-tokens/client bugs and would bury the signal. Adding a new
 * such edge case = pass `{ expected: true }` there; everything else is tracked.
 */
/**
 * The `audience` breakdown dimension: which app surface the failing request
 * came from (`customer` / `advertiser` / `admin` / `cross` / `public`). Authed
 * requests resolve it from the JWT entity (uid prefix) — exact even on
 * cross-app routes; unauthenticated ones fall back to the router mount prefix
 * (`/customers`, `/v2/advertisers`, …).
 */
function deriveAudience(req: Request): string {
  const uid = (req as any)?.user?.uid;
  if (typeof uid === "string") {
    const entity = getEntityFromUid(uid);
    if (entity === "CUSTOMER") return "customer";
    if (entity === "ADVERTISER") return "advertiser";
    if (entity === "ADMIN") return "admin";
  }
  const path: string = (req as any)?.path ?? "";
  const seg = /^\/(?:v2\/)?([^/]+)/.exec(path)?.[1];
  if (seg === "customers") return "customer";
  if (seg === "advertisers") return "advertiser";
  if (seg === "admin") return "admin";
  if (seg === "cross" || seg === "shared") return "cross";
  if (seg === "public") return "public";
  return "unknown"; // webhooks, health, stray paths
}

function reportApiError(req: Request, err: unknown, status: number) {
  if (isCustomError(err) && err.expected) return; // the only opt-out
  reportError(err, {
    source: "api",
    // ≥500 / unforeseen throw = a bug; a tracked 4xx = a deliberate domain
    // rejection we're counting, not a crash.
    errorClass: status >= 500 ? "unexpected" : "domain",
    service: "api",
    status,
    code: isCustomError(err) ? err.error.code : undefined,
    method: req?.method,
    path: (req as any)?.path,
    audience: deriveAudience(req),
    requestId: req?.headers?.["x-request-id"],
    // Anonymous like the clients — the acting entity's uid when authed, else "backend".
    distinctId: (req as any)?.user?.uid,
  });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;
  // Normalize Zod → shared code + issue list
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    // expected: pure input validation — high-volume transport noise, not tracked.
    err = createCustomError(ERROR_CODES.SERVER.ZOD /* 100 */, "ZodValidationError", {
      status: 400,
      errors: issues,
      expected: true,
    });
  }

  // Our structured errors
  if (isCustomError(err)) {
    const httpStatus = err.status ?? 500;
    logError(req, err, httpStatus);
    reportApiError(req, err, httpStatus);
    res.status(httpStatus).json({ error: err.error });
    return;
  }

  // Fallback: unexpected error
  logError(req, err, 500);
  reportApiError(req, err, 500);
  res.status(500).json({
    error: {
      code: ERROR_CODES.SERVER.INTERNAL, // 190
      message: "Internal Server Error",
    },
  });
};

export const notFound: RequestHandler = (_req, _res, next) => {
  next(
    // expected: 404 route scans / bot traffic — transport noise, not tracked.
    createCustomError(ERROR_CODES.SERVER.ROUTE_NOT_FOUND /* 140 */, "Route not found", {
      status: 404,
      expected: true,
    })
  );
};
