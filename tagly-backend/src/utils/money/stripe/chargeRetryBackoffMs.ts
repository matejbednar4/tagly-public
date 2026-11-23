import { PAYG_SETTLEMENT } from "../../../constants/billing/PAYG.js";

/** The two backoff tunables every off-session charge retry ladder carries. */
export type ChargeRetryPolicy = {
  RETRY_BACKOFF_BASE_MS: number;
  RETRY_BACKOFF_CAP_MS: number;
};

/**
 * Backoff before the next off-session charge retry, given how many attempts
 * have already failed (1-based): min(BASE * 2^(attempts-1), CAP). Defaults to
 * the PAYG settlement policy; the monthly-budget top-up passes
 * `MONTHLY_BUDGET_TOPUP`.
 */
export function chargeRetryBackoffMs(
  attemptsSoFar: number,
  policy: ChargeRetryPolicy = PAYG_SETTLEMENT,
): number {
  const exp = policy.RETRY_BACKOFF_BASE_MS * 2 ** (attemptsSoFar - 1);
  return Math.min(exp, policy.RETRY_BACKOFF_CAP_MS);
}
