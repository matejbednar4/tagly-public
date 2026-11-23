/**
 * Advertiser-facing share surfaces (home strips, rating). Invariant UX config.
 */
export const ADVERTISER_SHARES = {
  /**
   * How many unrated shares the "shares to rate" home strip returns per fetch
   * (oldest first). The endpoint also returns the full outstanding count for a
   * badge, so this only bounds the strip length, not what the advertiser can
   * rate.
   */
  UNRATED_STRIP_SIZE: 5,
};
