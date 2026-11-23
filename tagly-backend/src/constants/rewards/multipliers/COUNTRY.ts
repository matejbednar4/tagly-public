/**
 * Country-specific multiplier applied to the final share price, after the cap
 * and after the subsidized-vs-regular take split. The ECPM curve, action
 * bonuses, and cap are all defined in USD; this multiplier scales the result
 * to match local market pricing.
 *
 * Lookup key is the ISO alpha-2 country code from `Address.countryCode` (which
 * the geocoder returns and we persist verbatim).
 *
 * Adding a new country: add an entry here. The map's fallback in
 * `calculateShareFinalPriceCents` / `calculateLocalEstPriceAndRewardCents` is
 * `10_000` (1.0x — the US-equivalent rate), so an unmapped country is paid
 * the same as the US.
 */
export const COUNTRY_REWARD_MULTIPLIER_BPS: Record<string, number> = {
  US: 10_000, // 1.0x
  CZ: 7_000, // 0.7x — Czech-market PPP-adjusted ratio
};

/**
 * Fallback applied when a local's `countryCode` is not in the map above.
 * Equals the US rate so we don't accidentally zero out a customer's reward
 * if a new country ever sneaks through without an explicit mapping.
 */
export const DEFAULT_COUNTRY_REWARD_MULTIPLIER_BPS = 10_000;
