// Per-share pricing / payout tunables — lock %, platform take, subsidized pricing, max price.
// Consolidated from the former rewards/{lock,takes,subsidized} + algo/limits.

export const LOCK_BPS_OF_EST_PRICE = 15000; // 150%

export const SUBSIDIZED = {
  PRICE_MULTIPLIER_BPS: 6_000, // 0.60x — subsidized shares pay ~40% less than normal
  MAX_PRICE_RATIO: 0.5, // subsidized price is capped at 50% of the normal MAX_SHARE_PRICE_CENTS
};

export const REWARD_TAKES = {
  TAGLY_PLATFORM_TAKE_BPS: 4000, // 40%
};

export const MAX_SHARE_PRICE_CENTS = 5000; // $50.00 gross → $30.00 max customer reward (after 40% platform take)
