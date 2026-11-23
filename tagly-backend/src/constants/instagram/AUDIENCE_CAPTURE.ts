/**
 * Audience-capture breadth for Instagram snapshots — how many top
 * follower-location rows / demographic buckets to fetch + store, and the
 * coverage target per follower band.
 *
 * This is **data-collection policy** (IG-API cost + storage), NOT pricing: it is
 * independent of how the captured audience is later scored/priced (the geo/demo
 * multiplier tiers + bps stay versioned in `constants/rewards`). The
 * single permanent snapshot worker captures one way regardless of which
 * pricer later scores the data, so the policy is invariant-by-nature and
 * lives here.
 *
 * Relocated from `GEO_MULTIPLIER.topLocationSelection` /
 * `DEMOGRAPHICS_MULTIPLIER.topBucketSelection` — no pricer ever read them; only
 * the snapshot-capture utils do.
 */
export const AUDIENCE_LOCATION_CAPTURE = {
  mode: "cumulativeShare",
  minLocations: 3,
  maxLocations: 50,
  followerBandCaps: [
    { maxFollowers: 1_000, maxLocations: 20, percentageOfTotal: 0.65 },
    { maxFollowers: 5_000, maxLocations: 25, percentageOfTotal: 0.6 },
    { maxFollowers: 25_000, maxLocations: 30, percentageOfTotal: 0.55 },
    { maxFollowers: 100_000, maxLocations: 35, percentageOfTotal: 0.52 },
    { maxFollowers: Infinity, maxLocations: 40, percentageOfTotal: 0.4 },
  ],
} as const;

/**
 * Reached-audience capture policy — whether a snapshot's audience locations
 * come from `reached_audience_demographics` (who actually saw content in the
 * rolling window) instead of `follower_demographics`.
 *
 * The snapshot worker fetches the reached city breakdown alongside the
 * follower one and picks ONE source per snapshot (stamped on
 * `InstagramSnapshot.audienceLocationsSource`). Reached wins only when it
 * passes every guard below; otherwise the snapshot stays follower-based,
 * exactly like before. Follower rows are ALWAYS stored regardless (the
 * follower-based fallbacks read them), so these guards only govern which extra
 * data is captured and preferred, not retroactive pricing. This is capture policy (like the
 * band caps above), not versioned scoring: the geo tiers/bps that price the
 * chosen distribution stay in `constants/rewards`.
 */
export const REACHED_AUDIENCE_CAPTURE = {
  // Rolling last-30-days window. `this_week` (rolling 7d) exists but is too
  // often suppressed/thin for our account sizes (IG returns an empty dataset
  // below ~100 reached accounts in the window).
  timeframe: "this_month",

  // Guards — reached is used only if it passes ALL of these:
  // Absolute floor: below this the demographically-known sample is noise
  // (IG itself suppresses the metric under ~100 reached).
  minTotalValue: 150,
  // Relative floor: reached total must be at least this fraction of the
  // follower breakdown total, else the window undersamples the audience.
  minRatioOfFollowerTotal: 0.5,
  // Viral ceiling: reach far beyond the follower base means the window is
  // dominated by non-follower (viral) viewers — stories are seen almost
  // entirely by followers, so follower geography predicts story viewers better.
  viralMaxRatioOfFollowers: 2.0,
} as const;

export const AUDIENCE_DEMOGRAPHICS_CAPTURE = {
  minBuckets: 3,
  maxBuckets: 12,
  followerBandCaps: [
    { maxFollowers: 1_000, maxBuckets: 6, percentageOfTotal: 0.7 },
    { maxFollowers: 5_000, maxBuckets: 8, percentageOfTotal: 0.65 },
    { maxFollowers: 25_000, maxBuckets: 10, percentageOfTotal: 0.6 },
    { maxFollowers: 100_000, maxBuckets: 12, percentageOfTotal: 0.55 },
    { maxFollowers: Infinity, maxBuckets: 16, percentageOfTotal: 0.5 },
  ],
} as const;
