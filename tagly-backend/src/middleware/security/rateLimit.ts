import rateLimit, { Options as RateLimitOptions } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { RedisReply } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { createCustomError } from "../../utils/core/errors/createCustomError.js";
import { redis } from "../../utils/clients/redis.js";
import { RATE_LIMITS } from "../../constants/auth/RATE_LIMITS.js";
import { ERROR_CODES } from "@tagly/models/shared";

// Shared handler so all limiters return your JSON error via middleware chain
function onRateLimited(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(
    // expected: rate limiter working as intended (429) — not a bug, muted.
    createCustomError(ERROR_CODES.SERVER.RATE_LIMIT, "Too many requests", {
      status: 429,
      expected: true,
    })
  );
}

// A fresh Redis-backed store per limiter. express-rate-limit init()s each store
// with that limiter's options, so stores can't be shared; and each needs its own
// `prefix` because different limiters can produce identical keys (appIp + authIp
// both key by IP) that must not share a counter in the one Redis instance.
//
// Counters live in the shared ElastiCache (Valkey), so limits are enforced across
// ALL App Runner instances instead of per-process (the old MemoryStore gave each
// instance its own counter → effective limit was limit × N_instances).
function redisStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      (redis.call as (...a: string[]) => Promise<RedisReply>)(...args),
    prefix,
  });
}

// Helper to keep our limiter options consistent. `passOnStoreError: true` makes
// limiters FAIL OPEN: if Redis is unreachable the request is allowed through
// (logged) rather than 500'd — a cache outage must not take the API down.
function buildLimiter(prefix: string, opts: Partial<RateLimitOptions>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: RATE_LIMITS.standardHeaders,
    legacyHeaders: false,
    handler: onRateLimited,
    store: redisStore(prefix),
    passOnStoreError: true,
    ...opts,
  });
}

// Global per-IP
export const appIpLimiter = buildLimiter("rl:app-ip:", {
  windowMs: RATE_LIMITS.globalIp.windowMs,
  limit: RATE_LIMITS.globalIp.limit,
});

// Per-user (mount only after verifyJwt)
//
// Keyed on `uid`, never on `req.user.id`. The numeric id is a primary key in
// whichever table the uid's prefix names, and Customer/Advertiser/Admin are
// independent autoincrement sequences — so keying on it collapses a customer,
// an advertiser and an admin that happen to share a PK into ONE bucket, and
// either of them can exhaust the others' quota. The uid is globally unique
// because it is prefix-namespaced, so it is the only correct principal key.
export const authedUserLimiter = buildLimiter("rl:user:", {
  keyGenerator: (req) => req.user.uid,
  windowMs: RATE_LIMITS.authedUser.windowMs,
  limit: RATE_LIMITS.authedUser.limit,
});

// Strict IP for /public/auth/*
export const authIpLimiter = buildLimiter("rl:auth-ip:", {
  windowMs: RATE_LIMITS.authIp.windowMs,
  limit: RATE_LIMITS.authIp.limit,
});

// Gentle per-route limiter (spam protection)
export const gentlePerRouteLimiter = rateLimit({
  windowMs: RATE_LIMITS.perRouteGentle.windowMs,
  limit: RATE_LIMITS.perRouteGentle.limit,
  standardHeaders: RATE_LIMITS.standardHeaders,
  legacyHeaders: false,
  handler: onRateLimited,
  store: redisStore("rl:gentle:"),
  passOnStoreError: true,
  skip: (req) => {
    // Only throttle mutating requests
    if (
      !RATE_LIMITS.perRouteGentle.includeMethods.includes(req.method as any)
    ) {
      return true;
    }
    // Never throttle webhooks or auth
    if (req.path.startsWith("/webhooks/")) {
      return true;
    }
    if (
      req.baseUrl?.startsWith("/public/auth") ||
      req.path.startsWith("/public/auth")
    ) {
      return true;
    }

    if (!req.user) return true;

    return false;
  },
  keyGenerator: (req: Request) => {
    // uid, not id — see the note on `authedUserLimiter`. The path normally
    // separates the apps, but `/v2/cross/*` is called by both with identical
    // paths, so a PK collision there genuinely shared one write bucket.
    return `u:${req.user.uid}|${req.method}|${req.baseUrl}${req.path}`;
  },
});

// Instagram content endpoints - 1 request per 30 s per user per endpoint.
// Guards every route that hits the Instagram Graph API on each call:
// `GET /v2/customers/me/instagram/stories` and `POST /v2/customers/shares/create`.
export const instagramContentLimiter = buildLimiter("rl:ig-content:", {
  keyGenerator: (req) => `ig:${req.user.uid}:${req.path}`,
  windowMs: RATE_LIMITS.instagramContent.windowMs,
  limit: RATE_LIMITS.instagramContent.limit,
});

// App-open prompt — 1 request per 20 s per user
// Covers Instagram fetch + potential Rekognition cost; client retries after RateLimit-Reset
export const appOpenPromptLimiter = buildLimiter("rl:app-open:", {
  keyGenerator: (req) => `app-open:${req.user.uid}`,
  windowMs: RATE_LIMITS.appOpenPrompt.windowMs,
  limit: RATE_LIMITS.appOpenPrompt.limit,
});
