/**
 * Tunables for the customer Discover shelves (`/v2/customers/businesses/*`).
 * Not reward economics — these only shape candidate selection + result sizes, so
 * they are shared by every reader.
 */
export const DISCOVER = {
  /** Results returned per Discover shelf (recommended / top-earning / nearest). */
  SHELF_LIMIT: 12,

  /**
   * Recommended shelf: nearest interest-matched candidates pulled before randomly
   * sampling `SHELF_LIMIT` of them — so the shelf varies between visits instead of
   * always showing the same businesses, while the pool keeps results relevant +
   * local. Set to `SHELF_LIMIT` to disable the variety (deterministic nearest).
   */
  RECOMMENDED_CANDIDATE_POOL: 40,

  /**
   * Top-earning shelf: how many of the customer's highest-follower audience
   * locations anchor the candidate search. Geography is the dominant reward
   * multiplier, so we gather businesses near where the customer's followers are.
   */
  TOP_EARNING_AUDIENCE_LOCATIONS: 3,

  /** Top-earning shelf: radius (km) around each anchor location to gather from. */
  TOP_EARNING_CANDIDATE_RADIUS_KM: 50,

  /**
   * Top-earning shelf: candidates pulled (cheaply pre-scored by interest match +
   * proximity) and run through the reward hydrator before sorting by reward. A
   * ceiling on how many per-business price calcs we do per request.
   */
  TOP_EARNING_CANDIDATE_LIMIT: 20,
} as const;
