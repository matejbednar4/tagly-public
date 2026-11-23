// Decrease-only account-quality multiplier, driven by the follower:following
// ratio (FFR = followerCount / followingCount). Following far more accounts than
// follow you back is the classic follow-for-follow / bot / low-quality signal —
// that reach is worth less because those followers were acquired by reciprocity,
// not genuine interest. This penalty ONLY reduces the reward: a high FFR is
// expected of genuine accounts and never earns a bonus (the multiplier is
// clamped to ≤ 10_000 bps).
//
// Tuned for LOCAL CONSUMERS, not influencers. A normal person routinely follows
// somewhat more accounts than follow them (friends, brands, the places they
// visit), so the generic "aim for >1:1" influencer benchmarks would wrongly
// punish real users. The penalty therefore bites only clear imbalance, and only
// for accounts with enough absolute following to plausibly be farming.
export const ACCOUNT_QUALITY = {
  // Ratio band (followers / following). At/above HEALTHY_RATIO → no penalty;
  // at/below POOR_RATIO → the full penalty; linear in ratio between them.
  HEALTHY_RATIO: 0.7,
  POOR_RATIO: 0.15,

  // Deepest cut, reached at/below POOR_RATIO. 0.5 → pay 50% (worst farm case:
  // e.g. 200 followers / 2000 following).
  MAX_PENALTY_MULTIPLIER: 0.5,

  // The penalty never engages unless the account follows at least this many
  // accounts. A small/new account (e.g. 40 followers / 120 following) is not a
  // farm — low absolute following can't be. Also makes a 0-follower account
  // neutral unless it is mass-following.
  MIN_FOLLOWING_FOR_PENALTY: 500,

  // Account-size fade — FFR is only diagnostic for small accounts; large ones
  // naturally run high FFR and aren't judged on it. Full strength at/below
  // FULL_STRENGTH_MAX_FOLLOWERS, fading linearly to zero by NO_PENALTY_MIN_FOLLOWERS.
  FULL_STRENGTH_MAX_FOLLOWERS: 3000,
  NO_PENALTY_MIN_FOLLOWERS: 10000,
};
