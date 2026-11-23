import { ACCOUNT_QUALITY } from "../../../constants/rewards/multipliers/ACCOUNT_QUALITY.js";
import {
  rewardMessageBySlug,
  type RewardMessageSlug,
} from "@tagly/models/shared";

/**
 * Decrease-only account-quality multiplier (bps, ≤ 10_000) from the
 * follower:following ratio. Following far more accounts than follow back is the
 * follow-for-follow / bot / low-quality signal, so that reach is discounted. A
 * healthy or high ratio is never rewarded — the result is clamped at 10_000
 * (neutral). See ACCOUNT_QUALITY for the curve + rationale.
 *
 * Returns neutral (10_000) — no penalty — whenever we can't confidently judge:
 *   • followingCount unknown (IG omitted `follows_count`, or an older snapshot),
 *   • following below MIN_FOLLOWING_FOR_PENALTY (a small/new account can't be a
 *     farm — this also covers a 0-follower account that follows few),
 *   • ratio at/above HEALTHY_RATIO,
 *   • account large enough that the size fade has zeroed the penalty.
 *
 * `messageSlug` (LOW_FOLLOWER_RATIO) is emitted for the estimate UI when the
 * penalty drops the multiplier below the catalog threshold (0.75×), so the
 * customer sees why the reward is lower.
 */
export function calculateAccountQualityBps(args: {
  followerCount: number;
  followingCount: number | null | undefined;
}): { bps: number; messageSlug?: RewardMessageSlug } {
  const bps = computeBps(args);

  const threshold = rewardMessageBySlug.get("LOW_FOLLOWER_RATIO")?.threshold;
  const messageSlug =
    threshold !== undefined && bps < threshold
      ? ("LOW_FOLLOWER_RATIO" as const)
      : undefined;

  return { bps, messageSlug };
}

function computeBps(args: {
  followerCount: number;
  followingCount: number | null | undefined;
}): number {
  const followers = Math.max(0, Math.trunc(args.followerCount ?? 0));
  const following =
    args.followingCount == null
      ? null
      : Math.max(0, Math.trunc(args.followingCount));

  // Unknown following, or too few to be a farm → never penalize.
  if (
    following == null ||
    following < ACCOUNT_QUALITY.MIN_FOLLOWING_FOR_PENALTY
  ) {
    return 10_000;
  }

  const ratio = followers / following; // following ≥ 500 here, so no /0

  if (ratio >= ACCOUNT_QUALITY.HEALTHY_RATIO) return 10_000;

  // Depth of the penalty at this ratio, 0..1 of MAX (before the size fade).
  const penaltyFraction =
    ratio <= ACCOUNT_QUALITY.POOR_RATIO
      ? 1
      : (ACCOUNT_QUALITY.HEALTHY_RATIO - ratio) /
        (ACCOUNT_QUALITY.HEALTHY_RATIO - ACCOUNT_QUALITY.POOR_RATIO);

  const effectiveFraction = penaltyFraction * sizeFadeFactor(followers);
  if (effectiveFraction <= 0) return 10_000;

  // fraction 1 → MAX_PENALTY_MULTIPLIER; fraction 0 → 1 (neutral).
  const mult =
    1 - effectiveFraction * (1 - ACCOUNT_QUALITY.MAX_PENALTY_MULTIPLIER);
  const bps = Math.round(mult * 10_000);
  return Math.min(10_000, Math.max(0, bps));
}

// 1 at/below the small-account band, fading linearly to 0 by the large-account
// threshold — FFR is only diagnostic for smaller accounts.
function sizeFadeFactor(followers: number): number {
  const full = ACCOUNT_QUALITY.FULL_STRENGTH_MAX_FOLLOWERS;
  const none = ACCOUNT_QUALITY.NO_PENALTY_MIN_FOLLOWERS;
  if (followers <= full) return 1;
  if (followers >= none) return 0;
  return (none - followers) / (none - full);
}
