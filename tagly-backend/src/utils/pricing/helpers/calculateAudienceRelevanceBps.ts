// calculateAudienceRelevanceBps.ts
import { AUDIENCE_RELEVANCE } from "../../../constants/rewards/multipliers/AUDIENCE_RELEVANCE.js";

type FollowerTier = (typeof AUDIENCE_RELEVANCE)["followerTiers"][number];

/**
 * Account-authenticity multiplier, priced off FOLLOWER COUNT (v12).
 *
 * A small personal account's followers are people who actually know the
 * customer, so a recommendation carries weight; a large account's followers are
 * mostly strangers. That is a property of the account, so this reads
 * followerCount — never the post's reach. Post performance is already paid for
 * exactly once, in the base price (reach × eCPM); scoring it here as well would
 * charge the same axis twice and would hand the small-account boost to any big
 * account that happened to have a quiet post.
 *
 * `followerCount` is the count on the snapshot being priced (settlement) or the
 * latest snapshot / live IG count (estimates). It is absent only on the no-IG
 * manual-story-views path, which returns a neutral 10_000 — the same convention
 * the other multipliers follow when there is no Instagram data to judge.
 */
export function calculateAudienceRelevanceBps(args: {
  followerCount: number | null | undefined;
}): number {
  const followers = toPosInt(args.followerCount);
  if (followers <= 0) return 10_000;

  const rows = AUDIENCE_RELEVANCE.followerTiers as ReadonlyArray<FollowerTier>;
  if (!rows.length) return 10_000;

  const maxes = rows.map((r) => r.maxFollowers) as ReadonlyArray<number>;
  const idxHi = firstBandIndexGE(maxes, followers);
  const idxLo = Math.max(0, idxHi - 1);

  const ceil = rows[idxHi].maxFollowers;
  const m0 = rows[idxLo].mult;

  // Above the last finite anchor the multiplier is FLAT at that anchor's value
  // — the floor a large account can never fall below. Unlike the old
  // reach-keyed curve this needs no decaying tail: reach is now an independent
  // axis, so a bigger account can never out-earn a smaller one on the same view
  // count as long as the tiers are non-increasing.
  if (!Number.isFinite(ceil)) {
    const bps = Math.round(rows[idxLo].mult * 10_000);
    return bps > 0 ? bps : 10_000;
  }

  // floor = the follower count where m0 applies — the lower tier's OWN ceiling,
  // so the curve is continuous at every anchor. (For idxHi === idxLo — a count
  // inside the first tier — floor === ceil and positionLog returns 0 → flat m0.)
  const floor = rows[idxLo].maxFollowers;

  // Interpolate in LOG space: follower counts span orders of magnitude, so a
  // linear blend would spend almost the whole segment near the upper anchor.
  const m1 = rows[idxHi].mult;
  const t = positionLog(followers, floor, ceil);
  const mult = lerp(m0, m1, t);

  const bps = Math.round(mult * 10_000);
  return bps > 0 ? bps : 10_000;
}

// --- helpers ---
function toPosInt(x: number | null | undefined): number {
  if (typeof x !== "number" || !Number.isFinite(x) || x <= 0) return 0;
  return Math.trunc(x);
}

function firstBandIndexGE(maxes: ReadonlyArray<number>, value: number): number {
  for (let i = 0; i < maxes.length; i++) {
    if (value <= maxes[i]) return i;
  }
  return maxes.length - 1;
}

function positionLog(value: number, floor: number, ceil: number): number {
  if (!Number.isFinite(ceil) || ceil <= floor) return 0;
  const lv = Math.log10(Math.max(value, 1));
  const lf = Math.log10(Math.max(floor, 1));
  const lc = Math.log10(Math.max(ceil, floor + 1));
  let t = (lv - lf) / (lc - lf);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
