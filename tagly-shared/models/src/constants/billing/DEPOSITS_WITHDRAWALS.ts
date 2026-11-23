export const CREDIT_PURCHASES = {
  // Raised from $10 on 2026-07-11 (deliberate v1 behavior change, approved):
  // old shipped builds whose UI still allows $10-49 get a 400 from the backend
  // until the v2 cutover retires them.
  MIN_AMOUNT_CENTS: 5000, // $50.00
  MAX_AMOUNT_CENTS: 999_000_00, // $999,000.00
};

export const WITHDRAWALS = {
  MIN_AMOUNT_CENTS: 100, // $1.00
  MIN_AMOUNT_INSTANT_CENTS: 1000, // $10.00
  MAX_AMOUNT_CENTS: 999_000_00, // $999,000.00
};

export const ADMIN_CREDIT_PURCHASES = {
  MAX_AMOUNT_CENTS: 100_000, // $1,000.00
};
