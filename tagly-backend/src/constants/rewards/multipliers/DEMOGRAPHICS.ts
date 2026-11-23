// Map Match% (audience within target age+gender bins) → multiplier
export const DEMOGRAPHICS_MULTIPLIER = {
  bands: [
    { min: 0.0, max: 0.2, mult: 0.8 },
    { min: 0.2, max: 0.4, mult: 0.9 },
    { min: 0.4, max: 0.6, mult: 1.0 },
    { min: 0.6, max: 0.8, mult: 1.1 },
    { min: 0.8, max: 1.0, mult: 1.2 },
  ],
  default: 1.0,

  // NOTE: audience-capture breadth (how many demographic buckets to snapshot)
  // was relocated to `constants/instagram/AUDIENCE_CAPTURE.ts` — it is
  // data-collection policy, not scoring. This constant keeps only the pricing.
};

// BPS bounds for demographics multiplier
export const DEMOGRAPHICS_BOUNDS = {
  minBps: 8_000, // 0.80x minimum
  maxBps: 12_000, // 1.20x maximum
  weakBelowBps: 9_000, // Below 0.9x is considered WEAK
  strongAboveBps: 11_000, // Above 1.1x is considered STRONG
};

// Scoring weights for combining age and gender match scores
export const DEMOGRAPHICS_SCORING = {
  // Weight factors for combining age and gender scores (must sum to 1.0)
  ageWeight: 0.6, // Age match contributes 60%
  genderWeight: 0.4, // Gender match contributes 40%

  // Gender weight normalization bounds (from catalog definitions)
  // Used to normalize catalog gender weights (0.4-1.6) to a 0-1 scale
  minGenderWeight: 0.4,
  maxGenderWeight: 1.6,
};
