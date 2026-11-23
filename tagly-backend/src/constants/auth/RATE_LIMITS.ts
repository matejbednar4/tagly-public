export const RATE_LIMITS = {
  standardHeaders: "draft-8" as const,

  globalIp: { windowMs: 60_000, limit: 1200 }, // App-wide per-IP limiter (mounted globally after webhooks/health)
  authedUser: { windowMs: 60_000, limit: 60 }, // Per-user limiter (mount only after verifyJwt)
  authIp: { windowMs: 60_000, limit: 30 }, // Stricter per-IP limiter for /public/auth/* (login/register/forgot-password)

  perRouteGentle: {
    windowMs: 60_000,
    limit: 20,
    includeMethods: ["POST", "PUT", "PATCH", "DELETE"] as const,
  },

  perRouteStrict: { windowMs: 60_000, limit: 6 },

  // Instagram content endpoints - 2 requests per 30 s per user
  // limit:2 accounts for App Runner multi-instance behavior (same as appOpenPrompt)
  instagramContent: { windowMs: 30_000, limit: 2 },

  // App-open prompt — effectively 4 requests per minute per user
  // limit:8 doubles the true limit to account for App Runner multi-instance
  // behavior where each request may be handled by two instances simultaneously
  // (each with its own in-memory counter).
  appOpenPrompt: { windowMs: 60_000, limit: 8 },
} as const;
