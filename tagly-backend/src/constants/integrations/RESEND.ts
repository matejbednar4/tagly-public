/**
 * Resend account-level send budgeting.
 *
 * The Resend API rate limit is per ACCOUNT (default 2 requests/second on every
 * plan, including the $20 Pro plan — the 50k emails/month quota is a separate
 * number), and one account serves BOTH reputation streams
 * (`CONTACT.NOTIFICATIONS_FROM_EMAIL` + `CONTACT.MARKETING_FROM_EMAIL`) AND the
 * inline OTP/security mail sent from the API request path. A worker blast that
 * saturates the account 429s login OTPs (E057), so the worker deliberately
 * budgets itself BELOW the account limit and the remainder is standing headroom
 * reserved for inline sends (which are never throttled — a login code must not
 * wait behind promo mail).
 */
export const RESEND = {
  /** Account-wide API limit (requests/second) — confirm against the
   *  `ratelimit-limit` response header if the plan ever changes. */
  ACCOUNT_RATE_LIMIT_RPS: 2,

  /**
   * The notifications worker's share of the account limit, as a fixed window:
   * `maxSends` per `windowMs` (3 / 2000ms = 1.5 rps), leaving ~0.5 rps of
   * always-free headroom for inline OTP mail. Enforced cross-process via Redis
   * in `acquireEmailSendBudget` (fail-open).
   */
  WORKER_BUDGET: {
    windowMs: 2_000,
    maxSends: 3,
  },

  /**
   * Hard cap on how long one job may wait for budget before proceeding anyway
   * (fail-open). Kept well under the worker's 45s `jobTimeoutMs` so budget
   * waiting can never surface as a spurious job timeout.
   */
  MAX_BUDGET_WAIT_MS: 30_000, // 30 seconds
};
