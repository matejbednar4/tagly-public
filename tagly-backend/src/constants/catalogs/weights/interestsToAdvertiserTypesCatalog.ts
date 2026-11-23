import type { InterestSlug, AdvertiserTypeSlug } from "@tagly/models/shared";

// Compiled constants only — there is NO DB table for these weights. The
// pricer (utils/pricing/helpers/calculateInterestsBps.ts) reads
// this map directly, so the values ship inside the deployed image: a backend
// deploy IS the update, no seeding or migration involved. Retuning them still
// needs a v2 algo-version bump (META) so cached estimates invalidate and
// FinalPrice rows stay auditable per version.
export type InterestTypeWeightDef = {
  interestSlug: InterestSlug;
  typeSlug: AdvertiserTypeSlug;
  rewardMultiplierBps: number; // 10_000 = 1.00x
};

// ---------- INTEREST x ADVERTISER TYPE ----------
//
// The multiplier rewards posts whose audience is statistically likely to ALSO
// share the interest — i.e., follower-network density for that interest, not
// the strength of the semantic match.
//
// Example: a tennis player's followers are very likely to be tennis players too
// (clubs, doubles partners, regulars). A pilates-goer's followers are not —
// pilates is something most people do occasionally as a light hobby and don't
// build their social graph around. Same semantic strength of match, very
// different audience value.
//
// NOTE this multiplier STACKS with the intrinsic business-type multiplier
// (`calculateTypeBps` — cafe discount, sports-fitness boost, …): this one
// prices the audience match, that one prices the category. Keep the scale here
// modest so the combined product stays sane (e.g. tennis 1.40 × sports 1.15
// ≈ 1.61x combined).
//
// Scale:
//   1.40x   one-of-a-kind: subculture is tight enough that nearly every
//           follower shares the interest (tennis)
//   1.30x   high density: dedicated community that propagates well on IG
//           (padel, pets — pet content travels)
//   1.20x   solid hobby community (climbing partners; yoga IG community)
//   1.15x   clear category match where audience clusters meaningfully but
//           most followers don't share the interest (cross-racket pairs,
//           tattoo, theater)
//   1.05–1.10x   light signal — kept as an explicit row when it must sit
//           BELOW the fallback the pair would otherwise get (see below)
//
// An explicit row overrides the vertical→vertical fallback in BOTH
// directions: rows above it boost (tennis), rows below it dampen — e.g.
// fashion→thrift 1.10 undercuts the fashion↔fashion diagonal (1.15), and
// cafe-culture→cafe 1.05 undercuts the same-vertical default (1.10). Only
// skip a row when the fallback value is already right for the pair.

export const interestToTypeWeights: InterestTypeWeightDef[] = [
  // --- TIGHT FOLLOWER NETWORK (1.30–1.40x) ---
  // Tennis players follow tennis players — clubs, doubles partners, regular
  // matches make this the densest sub-community in the catalog.
  {
    interestSlug: "tennis",
    typeSlug: "tennis-court",
    rewardMultiplierBps: 140_00,
  },
  // Padel community is similar in nature to tennis but smaller and newer.
  {
    interestSlug: "padel",
    typeSlug: "padel-court",
    rewardMultiplierBps: 130_00,
  },
  // Pet content has extraordinary follower correlation — pet people follow
  // other pet people in big numbers on IG.
  {
    interestSlug: "pets",
    typeSlug: "pet-services",
    rewardMultiplierBps: 130_00,
  },

  // --- DEDICATED HOBBY COMMUNITY (1.20x) ---
  // Climbers move in pairs/groups; gym regulars know each other.
  {
    interestSlug: "climbing",
    typeSlug: "climbing-gym",
    rewardMultiplierBps: 120_00,
  },
  // Yoga has a real IG community (daily-yoga creators, retreats, teacher
  // training cohorts). More follower density than pilates.
  {
    interestSlug: "yoga",
    typeSlug: "yoga-studio",
    rewardMultiplierBps: 120_00,
  },

  // --- CROSS-RELATED NICHE PAIRS (1.15x) ---
  // Padel ↔ Tennis: many players cross over, communities overlap.
  {
    interestSlug: "tennis",
    typeSlug: "padel-court",
    rewardMultiplierBps: 115_00,
  },
  {
    interestSlug: "padel",
    typeSlug: "tennis-court",
    rewardMultiplierBps: 115_00,
  },

  // --- MODEST CATEGORY MATCH (1.05–1.15x) ---
  // Subculture exists but most followers don't share the interest in practice.
  // The 1.05–1.10 rows deliberately sit AT or BELOW their fallback (see the
  // header note) — they dampen pairs the diagonal would over-reward.
  {
    interestSlug: "tattoo-piercing",
    typeSlug: "tattoo-piercing-studio",
    rewardMultiplierBps: 115_00,
  },
  // Small, dedicated theater audience.
  {
    interestSlug: "theater-performing-arts",
    typeSlug: "theater",
    rewardMultiplierBps: 115_00,
  },
  // Beer enthusiasts cluster more than wine enthusiasts on IG.
  {
    interestSlug: "beer-wine",
    typeSlug: "brewery",
    rewardMultiplierBps: 110_00,
  },
  {
    interestSlug: "beer-wine",
    typeSlug: "winery",
    rewardMultiplierBps: 110_00,
  },
  // Vintage / thrift fashion has a strong IG aesthetic community.
  {
    interestSlug: "fashion",
    typeSlug: "thrift-vintage-store",
    rewardMultiplierBps: 110_00,
  },
  // Cafe-aesthetic IG culture is a real cluster.
  {
    interestSlug: "cafe-culture",
    typeSlug: "cafe",
    rewardMultiplierBps: 105_00,
  },
  // Going out has social signal but is broad.
  {
    interestSlug: "bars-nightlife",
    typeSlug: "nightclub",
    rewardMultiplierBps: 105_00,
  },
  {
    interestSlug: "bars-nightlife",
    typeSlug: "shisha-lounge",
    rewardMultiplierBps: 105_00,
  },
];

// Fast lookup map
const key = (i: InterestSlug, t: AdvertiserTypeSlug) => `${i}|${t}`;

const overrides = new Map<string, InterestTypeWeightDef>();
for (const w of interestToTypeWeights) {
  overrides.set(key(w.interestSlug, w.typeSlug), w);
}

// API: returns bps if an explicit Interest→Type match exists; otherwise null.
export function getInterestTypeWeightBps(
  interestSlug: InterestSlug,
  typeSlug: AdvertiserTypeSlug,
): number | null {
  const exact = overrides.get(key(interestSlug, typeSlug));
  if (exact) return exact.rewardMultiplierBps;

  return null;
}
