import { MONTHLY_BUDGET_TOPUP } from "../../../constants/billing/MONTHLY_BUDGET.js";

/**
 * Calendar helpers for the monthly-budget run. Everything is UTC: a "month"
 * is the UTC calendar month, and a run is due on its 1st at
 * `CHARGE_HOUR_UTC` (06:00 UTC — the 1st in US Eastern and CZ; see the
 * constant for the West-Coast note).
 */

/**
 * When the run after `from` is due: the 1st of the following month at
 * `CHARGE_HOUR_UTC`. Set on every terminal outcome (charged / skipped) and on
 * open, so a period is always scheduled exactly one run ahead.
 *
 * Always the FOLLOWING month, never "the next 1st that hasn't happened yet":
 * opening a period at 05:00 on the 1st schedules the next month rather than an
 * hour later. Activation must never charge (see `openMonthlyBudgetPeriod`), and
 * a same-day charge would break that for one hour of the month.
 */
export function nextMonthlyBudgetRunAt(from: Date): Date {
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + 1,
      1,
      MONTHLY_BUDGET_TOPUP.CHARGE_HOUR_UTC,
    ),
  );
}

/**
 * "YYYY-MM" (UTC) — the month identity baked into the per-attempt Stripe
 * idempotency key / `StripeCreditPurchase.externalRef` and the notification
 * dedupe keys. Never stored: the DB keeps only `nextRunAt`, and "this month
 * is done" is simply that `nextRunAt` points into a later month (which is
 * why the worker's `nextRunAt <= now` poll never re-picks it).
 */
export function monthlyBudgetPeriodKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
