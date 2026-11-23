export const GEO_MULTIPLIER = {
  // GEO IS A FRACTION OF REACH, NOT A BONUS MULTIPLIER (v12).
  //
  // The value below is "what share of this post's views count as local" —
  // 1.0 means every viewer is in the business's city, 0.0 means nobody is
  // near enough to ever walk in. It is deliberately capped at 1.0: the
  // near-audience premium lives in the eCPM (BASE_ECPMS is the price of 1000
  // LOCAL views), not here. Before v12 this was a 0.01x–2.25x bonus applied
  // to raw reach, which paid real money for audiences hundreds of km away —
  // a 23%-Prague account still scored 0.94x.

  noGeoBps: 2000, // 20% assumed local when no geo data is available (v12)

  minBps: 0, // 0.0 — an audience entirely outside the catchment is worth nothing
  maxBps: 10_000, // 1.0 — every view is local; there is nothing above "all of them"

  weakBelowBps: 3_500, // under 35% of views local is WEAK
  strongAboveBps: 7_000, // over 70% of views local is STRONG

  // Distance→locality as a CONTINUOUS piecewise-linear curve (not stepped
  // tiers): between two anchors the value is linearly interpolated, so there
  // is no cliff — 24km and 26km price almost identically. Distance is
  // centroid-to-centroid (audience city → business city). Below the first
  // anchor everything gets its value; at/above the last anchor, its.
  //
  // Reads as "how likely is a viewer this far away to actually visit":
  //   same city 100% · 10km 90% · 25km 55% · 50km 20% · 70km 5% · ≥85km 0%
  // Calibrated for Czechia: Kladno/Beroun (~25-30km) are commuter belt and
  // still count for about half; Příbram (~50km) is an occasional trip at 20%;
  // past ~85km nobody is driving in for a coffee, so those views are free.
  distanceCurve: [
    { km: 0, multiplier: 1.0 },
    { km: 10, multiplier: 0.9 },
    { km: 20, multiplier: 0.7 },
    { km: 25, multiplier: 0.55 },
    { km: 35, multiplier: 0.38 },
    { km: 50, multiplier: 0.2 },
    { km: 60, multiplier: 0.12 },
    { km: 70, multiplier: 0.05 },
    { km: 85, multiplier: 0.0 },
  ],

  // NOTE: audience-capture breadth (how many top locations to snapshot) was
  // relocated to `constants/instagram/AUDIENCE_CAPTURE.ts` — it is
  // data-collection policy, not scoring. This constant keeps only the pricing.
  normalizeWeights: true,
} as const;

/**
 * Base geo value (in bps) used when the customer has no Instagram connected
 * and reach is derived from a manually-entered story-views estimate. Without a
 * snapshot we cannot compute real geo overlap, so each market gets a flat
 * assumed local share.
 *
 * On the v12 fraction scale these read as "we assume N% of the views are
 * local". They were halved alongside the 2x eCPM raise so the absolute payout
 * on these paths is unchanged from v11 (CZ was 1.7x against a $25 eCPM;
 * 0.85 against $50 is the same money).
 *
 * Lookup key is the ISO alpha-2 country code from `Address.countryCode`.
 * Falls back to `NO_IG_GEO_BASE_DEFAULT_BPS` when a country is not mapped.
 */
export const NO_IG_GEO_BASE_BPS_BY_COUNTRY: Record<string, number> = {
  US: 6_500, // 65% assumed local
  CZ: 8_500, // 85% assumed local
};

export const NO_IG_GEO_BASE_DEFAULT_BPS = 6_500; // 65% assumed local
