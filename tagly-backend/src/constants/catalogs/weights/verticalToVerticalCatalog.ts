import type { VerticalSlug } from "@tagly/models/shared";

export const DEFAULT_SAME_VERTICAL_BPS = 110_00; // 1.10x when same vertical and no explicit diagonal override

export type VerticalToVerticalWeightDef = {
  from: VerticalSlug;
  to: VerticalSlug;
  rewardMultiplierBps: number; // 10_000 = 1.00x
};

// Only verticals present in @tagly/models verticalsCatalog can appear here.
// Trimmed in lockstep with the verticals trim (dropped: automotive,
// finance-insurance, home-real-estate, non-profit-community,
// technology-electronics, education, health-medical).

export const verticalToVerticalWeights: VerticalToVerticalWeightDef[] = [
  // --- Diagonals (same-vertical affinities) ---
  { from: "fashion", to: "fashion", rewardMultiplierBps: 115_00 },
  {
    from: "beauty-wellness",
    to: "beauty-wellness",
    rewardMultiplierBps: 115_00,
  },
  { from: "sports-fitness", to: "sports-fitness", rewardMultiplierBps: 115_00 },
  {
    from: "lifestyle-hobbies",
    to: "lifestyle-hobbies",
    rewardMultiplierBps: 105_00,
  },

  // --- Cross-vertical synergies (store one direction; we'll mirror at runtime) ---
  { from: "beauty-wellness", to: "fashion", rewardMultiplierBps: 112_00 },
  { from: "fashion", to: "retail", rewardMultiplierBps: 110_00 },
  {
    from: "sports-fitness",
    to: "travel-hospitality",
    rewardMultiplierBps: 110_00,
  },
  {
    from: "sports-fitness",
    to: "lifestyle-hobbies",
    rewardMultiplierBps: 108_00,
  },
  { from: "food-drink", to: "travel-hospitality", rewardMultiplierBps: 108_00 },
  {
    from: "travel-hospitality",
    to: "entertainment",
    rewardMultiplierBps: 108_00,
  },
];

// Key both directions to avoid branching on every lookup.
const pairKey = (from: VerticalSlug, to: VerticalSlug) => `${from}|${to}`;

const verticalPairBps = new Map<string, number>();

for (const w of verticalToVerticalWeights) {
  verticalPairBps.set(pairKey(w.from, w.to), w.rewardMultiplierBps); // forward
  verticalPairBps.set(pairKey(w.to, w.from), w.rewardMultiplierBps); // mirrored reverse
}

// get bps for a given (from vertical, to vertical)
// Returns null when no explicit weight is set (treat as 1.00x in caller).
// If from === to and there is no explicit diagonal, fall back to DEFAULT_SAME_VERTICAL_BPS.
export function getVerticalToVerticalWeightBps(
  from: VerticalSlug,
  to: VerticalSlug
): number | null {
  const direct = verticalPairBps.get(pairKey(from, to));
  if (typeof direct === "number") {
    return direct;
  }

  if (from === to) {
    return DEFAULT_SAME_VERTICAL_BPS;
  }

  return null;
}
