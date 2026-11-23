export const LIMIT_IG_STORY_FETCH = 50;
export const LIMIT_IG_POST_FETCH = 50;

export const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Hard timeout for a single IG Graph API request (token exchange/refresh,
// profile fetch, permission check). The snapshot worker has its own
// `IG_SNAPSHOT.fetchTimeoutMs`.
export const IG_HTTP_TIMEOUT_MS = 15 * 1000; // 15 s

/**
 * When a STORY's insights are collected, relative to `postedToIgAt`.
 *
 * A story is only queryable for 24 h, so the job is scheduled near the end of
 * that window (fullest metrics) and hard-expires with it — once `validUntil`
 * passes, `expireInsightsJobs` fails the job and voids the share.
 *
 * **The gap between the two is the only slack the whole pipeline has.** If the
 * job is not claimed AND executed inside it, a perfectly valid share is voided
 * and the customer is not paid. Widened 15 min → 30 min so a worker restart, a
 * deploy recycle, or a transient IG retry can be absorbed. Two invariants when
 * touching these: keep `collectAfterMs` < `validForMs`, and keep the margin
 * between them comfortably larger than the maintenance worker's `loopIdleMs` —
 * the requeue that rescues a stranded job only runs on that cycle.
 */
export const STORY_INSIGHTS_SCHEDULE = {
  collectAfterMs: (23 * 60 + 30) * 60 * 1000, // postedToIgAt + 23h30m
  validForMs: 24 * 60 * 60 * 1000, // postedToIgAt + 24h — IG's hard window
} as const;

export const IG_SNAPSHOT = {
  // Default list sizes and delays
  locationTopNDefault: 5,
  fetchTimeoutMs: 15_000,
  geocodeDelayMs: 500,

  // Periods for each audience kind
  periods: {
    followers: "lifetime" as const,
    engaged: "this_week" as const,
    reached: "this_week" as const,
  },

  // Signal thresholds to decide if engaged/reached are usable
  // (You can feed these with account-level aggregates when available)
  minReachForReachedLocations: 1_000,
  minEngagedForEngagedLocations: 200,
} as const;
