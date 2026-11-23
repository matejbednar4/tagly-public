import { MAX_SHARE_PRICE_CENTS } from "../../../constants/rewards/PRICING.js";
import { SUBSIDIZED } from "../../../constants/rewards/PRICING.js";
import { bpsOfCents } from "../../formatting/bpsOfCents.js";

/**
 * Applies the final price cap to a computed subtotal.
 *
 * Regular:   min(subtotal, MAX_SHARE_PRICE_CENTS)
 * Subsidized: min(subtotal × 0.60, MAX_SHARE_PRICE_CENTS × 0.50)
 */
export function applyPriceCap(
  subtotalCents: bigint,
  isSubsidized: boolean
): bigint {
  if (isSubsidized) {
    const discounted = bpsOfCents(subtotalCents, SUBSIDIZED.PRICE_MULTIPLIER_BPS);
    const subsidizedMax = BigInt(
      Math.floor(MAX_SHARE_PRICE_CENTS * SUBSIDIZED.MAX_PRICE_RATIO)
    );
    return discounted < subsidizedMax ? discounted : subsidizedMax;
  }

  const max = BigInt(MAX_SHARE_PRICE_CENTS);
  return subtotalCents < max ? subtotalCents : max;
}
