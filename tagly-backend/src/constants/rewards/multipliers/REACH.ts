export const REACH_FROM_FOLLOWER_COUNT = [
  { maxFollowerCount: 300, take: 0.55 },
  { maxFollowerCount: 1000, take: 0.45 },
  { maxFollowerCount: 3000, take: 0.35 },
  { maxFollowerCount: 10000, take: 0.25 },
  { maxFollowerCount: 50000, take: 0.18 },
  { maxFollowerCount: Infinity, take: 0.12 },
];

// Ceiling on the STORY reach a customer can be paid for, expressed as a
// multiple of their follower count. Stories are seen mostly by followers, so a
// customer's own audience is the natural bound — but a business re-sharing a
// customer's story can balloon its reach far past that (a 200-follower account
// hitting 2k reach because the cafe reshared it), making the business overpay
// for reach it generated itself. Capping payable reach at followerCount ×
// multiplier removes that inflation.
//
// The multiplier DECLINES with account size: story reach as a fraction of
// followers naturally drops as accounts grow (see REACH_FROM_FOLLOWER_COUNT),
// so a genuine large-account story never needs a >1× allowance, and a tighter
// cap there keeps the reshare inflation in check. Between the two follower
// anchors the multiplier is log-linearly interpolated (see
// capReachAtFollowerBaseline), clamped to [MIN_MULTIPLIER, MAX_MULTIPLIER]:
//   ≤1k → 1.15 · 3k → ~1.07 · 10k → ~0.98 · 50k → ~0.85 · ≥100k → 0.80
//
// ABSOLUTE_REACH_FLOOR keeps the cap from zeroing out a genuine post by a
// tiny/brand-new account (followerCount × multiplier ≈ 0): every capped account
// can still be paid for at least this much reach.
export const REACH_CAP = {
  MAX_MULTIPLIER: 1.15, // applied at/below MIN_FOLLOWERS_FOR_DECAY
  MIN_MULTIPLIER: 0.8, // applied at/above MAX_FOLLOWERS_FOR_DECAY
  MIN_FOLLOWERS_FOR_DECAY: 1000, // ≤ this → MAX_MULTIPLIER (flat)
  MAX_FOLLOWERS_FOR_DECAY: 100000, // ≥ this → MIN_MULTIPLIER (flat)
  ABSOLUTE_REACH_FLOOR: 150, // never cap payable reach below this
};
