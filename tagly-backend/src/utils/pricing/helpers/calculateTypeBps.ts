import {
  advertiserTypeBySlug,
  verticalBySlug,
  type AdvertiserTypeSlug,
} from "@tagly/models/shared";

const ONE_X = 10_000;

/**
 * Business-type price multiplier (bps): how much a post for this CATEGORY of
 * business is worth, independent of who posts it — e.g. cafes discounted below
 * the food-drink baseline (low margins, high volume), sports/beauty verticals
 * boosted above it. Values live ONLY in the @tagly/models catalogs (single
 * source; comments there, not here — quoted numbers drift).
 *
 * Distinct from the two *match* multipliers that also read the type
 * (interests×type, demographics×type): this one prices the type itself.
 * The values live in the shared catalogs (`@tagly/models`): the type's
 * `rewardMultiplierBps` override when set, else its PRIMARY (first-listed)
 * vertical's value. Catalog-only: the old DB copies of these values were
 * write-only (no reader) and were dropped at algo v11.
 * An unknown slug prices neutral (1.0x) rather than zeroing a reward.
 *
 * Wired into the pricing pipeline at algo v11 — the catalog values existed
 * (and were seeded to the DB) since the beginning but were never read by any
 * pricer before that.
 */
export function calculateTypeBps(typeSlug: string): number {
  const type = advertiserTypeBySlug.get(typeSlug as AdvertiserTypeSlug);
  if (!type) return ONE_X;

  if (typeof type.rewardMultiplierBps === "number") {
    return type.rewardMultiplierBps;
  }

  const primaryVerticalSlug = type.verticalSlugs[0];
  if (!primaryVerticalSlug) return ONE_X;

  return verticalBySlug.get(primaryVerticalSlug)?.rewardMultiplierBps ?? ONE_X;
}
