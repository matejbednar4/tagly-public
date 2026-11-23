import { CREDIT_PURCHASES } from "./DEPOSITS_WITHDRAWALS";

/**
 * Monthly budget — the recurring top-up: on the 1st of each month the
 * advertiser's saved card is charged `target − available credits`, so they
 * always start the month with `target` to spend. Bounds mirror the one-off
 * credit purchase (the same funding floor/ceiling) and are enforced by the Zod
 * schema of `PUT /v2/advertisers/me/billing/monthly-budget`.
 */
export const MONTHLY_BUDGET = {
  MIN_TARGET_CENTS: CREDIT_PURCHASES.MIN_AMOUNT_CENTS, // $50.00
  MAX_TARGET_CENTS: CREDIT_PURCHASES.MAX_AMOUNT_CENTS, // $999,000.00
  /**
   * Shortfalls below this are not charged (the advertiser is effectively at
   * target, and a sub-$5 card charge is mostly Stripe fee). Shared so the app
   * can state "nothing is charged now" exactly when the backend skips.
   */
  MIN_TOPUP_CENTS: 500, // $5.00
} as const;
