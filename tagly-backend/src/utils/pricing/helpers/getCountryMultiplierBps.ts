import {
  COUNTRY_REWARD_MULTIPLIER_BPS,
  DEFAULT_COUNTRY_REWARD_MULTIPLIER_BPS,
} from "../../../constants/rewards/multipliers/COUNTRY.js";

/**
 * Resolves the country-specific reward multiplier (bps) for a local's ISO
 * alpha-2 `countryCode`. The ECPM curve, action bonuses, and cap are all
 * defined in USD; this scales price/reward to local market pricing. Unmapped
 * countries fall back to the US rate (1.0x) rather than zeroing the reward.
 *
 * Shared by `calculateEstPrice` and `calculateFinalPrice` so the estimate the
 * customer sees lines up with what eventually gets paid.
 */
export function getCountryMultiplierBps(countryCode: string): number {
  return (
    COUNTRY_REWARD_MULTIPLIER_BPS[countryCode] ??
    DEFAULT_COUNTRY_REWARD_MULTIPLIER_BPS
  );
}
