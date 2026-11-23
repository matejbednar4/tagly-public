// Referral economics — the referrer's cut of Tagly's platform take, plus the
// sign-up boost window + post-window decay. Backend-only (NOT in @tagly/models),
// so the rates are never shipped in a client bundle; the client receives the
// already-computed effective percentages from `GET /v2/customers/me/referrals`.
// Permanent (platform economics): the referral split is an invariant policy, not
// part of the per-version pricing algorithm — one canonical rate used by every API
// version. (The relevance/scoring algorithm in rewards/{ECPM,multipliers,...} is
// what stays versioned; the take/lock/referral economics do not.)

export const REFERRAL_TAKES_BPS = {
  ADVERTISER_REFERRER_TAKE_BPS: 4000, // 40% of Tagly take
  CUSTOMER_REFERRER_TAKE_BPS: 2000, // 20% of Tagly take
} as const;

// full-strength duration for sign-up referrals (after this, they decay)
export const REFERRAL_FULL_REWARD_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // ~6 months
export const REFERRAL_DECAYED_BPS = 5_000; // 50% of base
