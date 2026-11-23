/**
 * Tunables for pay-as-you-go (PAYG) settlement card charging.
 *
 * When a live (lock-less) PAYG share reaches settlement, the advertiser's card is
 * charged off-session for the shortfall. On decline the charge is retried with
 * exponential backoff; after MAX_CHARGE_ATTEMPTS the customer is still paid in
 * full and the advertiser's available balance goes negative (a receivable).
 */
export const PAYG_SETTLEMENT = {
  /** Off-session charge attempts before falling back to the negative-balance path. */
  MAX_CHARGE_ATTEMPTS: 4,

  /** First retry delay after a decline; doubled each subsequent attempt. (6 hours) */
  RETRY_BACKOFF_BASE_MS: 6 * 60 * 60 * 1000,

  /** Upper bound on the per-attempt backoff. (48 hours) */
  RETRY_BACKOFF_CAP_MS: 48 * 60 * 60 * 1000,
} as const;
