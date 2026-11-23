import { REACH_CAP } from "../../../constants/rewards/multipliers/REACH.js";

/**
 * The follower-baseline reach cap multiplier for a given follower count.
 *
 * Flat at MAX_MULTIPLIER up to MIN_FOLLOWERS_FOR_DECAY, flat at MIN_MULTIPLIER
 * from MAX_FOLLOWERS_FOR_DECAY on, and log-linearly interpolated between (reach
 * ratios move by orders of magnitude across account sizes, so we interpolate in
 * log10(followers), not raw followers).
 */
function reachCapMultiplier(followerCount: number): number {
  const f = Math.max(0, Math.trunc(followerCount));

  if (f <= REACH_CAP.MIN_FOLLOWERS_FOR_DECAY) return REACH_CAP.MAX_MULTIPLIER;
  if (f >= REACH_CAP.MAX_FOLLOWERS_FOR_DECAY) return REACH_CAP.MIN_MULTIPLIER;

  const lo = Math.log10(REACH_CAP.MIN_FOLLOWERS_FOR_DECAY);
  const hi = Math.log10(REACH_CAP.MAX_FOLLOWERS_FOR_DECAY);
  const t = (Math.log10(f) - lo) / (hi - lo); // 0 → 1 across the decay range
  return (
    REACH_CAP.MAX_MULTIPLIER +
    t * (REACH_CAP.MIN_MULTIPLIER - REACH_CAP.MAX_MULTIPLIER)
  );
}

/**
 * Caps the reach a customer can be paid for at followerCount × multiplier (with
 * an absolute floor), so a business re-sharing a customer's STORY can't inflate
 * the payable reach — and therefore the price — beyond the customer's own
 * audience. See REACH_CAP for the rationale and the multiplier curve.
 *
 * Story-only: callers apply this to STORY reach exclusively. Reels/posts can
 * legitimately reach far past follower count (explore page), so they are never
 * capped here.
 *
 * `followerCount` should be the follower count captured for the same window as
 * `reach` (the share's snapshot at settlement; the latest snapshot for
 * estimates). A 0 / missing follower count (a near-zero-follower account — the
 * exact reshare-exploit shape) collapses the multiplier term to 0, so the cap
 * falls to ABSOLUTE_REACH_FLOOR rather than zeroing the reward.
 */
export function capReachAtFollowerBaseline(
  reach: number,
  followerCount: number,
): number {
  const cap = Math.max(
    Math.round(Math.max(0, Math.trunc(followerCount)) * reachCapMultiplier(followerCount)),
    REACH_CAP.ABSOLUTE_REACH_FLOOR,
  );
  return Math.min(reach, cap);
}
