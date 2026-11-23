/**
 * Tunables for the monthly-budget top-up (the recurring "top my credits back
 * up to X on the 1st" charge). Amount bounds and the $5 skip floor live in
 * `@tagly/models` (`MONTHLY_BUDGET`) because the client mirrors them.
 *
 * The retry ladder mirrors PAYG settlement charging: a definitive decline is
 * retried with exponential backoff; after MAX_CHARGE_ATTEMPTS the period is
 * closed (CHARGE_FAILED — the "pause") and the advertiser is told to update
 * their card.
 */
export const MONTHLY_BUDGET_TOPUP = {
  /** Off-session charge attempts per month before the period is paused. */
  MAX_CHARGE_ATTEMPTS: 4,

  /** First retry delay after a decline; doubled each subsequent attempt. (3 hours) */
  RETRY_BACKOFF_BASE_MS: 3 * 60 * 60 * 1000,

  /** Upper bound on the per-attempt backoff. (24 hours) */
  RETRY_BACKOFF_CAP_MS: 24 * 60 * 60 * 1000,

  /**
   * Recheck delay after an AMBIGUOUS charge outcome (timeout / 5xx — the
   * charge may exist). No attempt is consumed and the idempotency key is kept,
   * so the recheck either adopts the collected charge or replays it. (10 minutes)
   */
  AMBIGUOUS_RECHECK_MS: 10 * 60 * 1000,

  // The skip floor (MIN_TOPUP_CENTS, $5) lives in `@tagly/models`
  // `MONTHLY_BUDGET` — the app mirrors it to say "nothing charged now".

  /**
   * Hour (UTC) of the 1st at which the run is due. 06:00 UTC is the 1st in
   * the home market and in CZ (01:00–02:00 US Eastern, 07:00–08:00 Prague);
   * on the US West Coast it is still the evening of the last day of the
   * previous month (22:00–23:00 Pacific), which only shows on the card
   * statement — every date the app/emails render uses the UTC calendar day
   * (`formatChargeDate`, `formatNoticeDate`), so those still say "the 1st".
   * Raise to 8 if a Pacific-dated statement ever matters (00:00 PST).
   */
  CHARGE_HOUR_UTC: 6,

  /** How long before `nextRunAt` the "upcoming charge" email goes out. (3 days) */
  UPCOMING_NOTICE_LEAD_MS: 3 * 24 * 60 * 60 * 1000,

  /**
   * Never send the "upcoming charge" email when the run is closer than this —
   * a heads-up about a charge minutes away is noise (a period that was just
   * opened tops up within seconds; a worker catching up after downtime should
   * not announce what it is about to do). (1 hour)
   */
  UPCOMING_NOTICE_MIN_LEAD_MS: 60 * 60 * 1000,
} as const;
