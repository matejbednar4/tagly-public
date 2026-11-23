import {
  DEMOGRAPHICS_MULTIPLIER,
  DEMOGRAPHICS_BOUNDS,
  DEMOGRAPHICS_SCORING,
} from "../../../constants/rewards/multipliers/DEMOGRAPHICS.js";
import { getTargetDemographics } from "../../../constants/catalogs/weights/advertiserTypeTargetDemographicsCatalog.js";

const ONE_X = 10_000;

// Destructure scoring constants for cleaner code
const { ageWeight, genderWeight, minGenderWeight, maxGenderWeight } =
  DEMOGRAPHICS_SCORING;
const genderWeightRange = maxGenderWeight - minGenderWeight;

type AudienceBucket = {
  gender: "M" | "F" | "U";
  age: string;
  value: number;
};

function normalizeGenderScore(targetGenderWt: number): number {
  // If someone misconfigures bounds, avoid divide-by-zero.
  // Use neutral 0.5 so we neither reward nor penalize purely because of config.
  if (genderWeightRange <= 0) {
    return 0.5;
  }

  return Math.min(
    1,
    Math.max(0, (targetGenderWt - minGenderWeight) / genderWeightRange)
  );
}

/**
 * Calculate the demographics multiplier in basis points.
 *
 * Industry-standard behavior:
 * - Age is a hard gate: buckets outside target ages contribute 0.
 * - Gender only refines score inside target ages.
 * - Unknown gender ("U") gets no gender bonus (conservative).
 *
 * @returns BPS value (10_000 = 1.0x, 8_000 = 0.8x, 12_000 = 1.2x)
 */
export function calculateDemographicsBps({
  local,
  audienceGenderAges,
}: {
  local: { type: { slug: string } } | null;
  audienceGenderAges: AudienceBucket[] | null;
}): number {
  // No local or no type slug → neutral
  const typeSlug = local?.type?.slug;
  if (!typeSlug) {
    return ONE_X;
  }

  // Get target demographics for this business type
  const target = getTargetDemographics(typeSlug);
  if (!target) {
    // Business type has no target demographics defined → neutral
    return ONE_X;
  }

  // Defensive: a target with no age ranges can't be evaluated sensibly
  if (!target.targetAgeRanges || target.targetAgeRanges.length === 0) {
    return ONE_X;
  }

  // No audience data → neutral
  if (!audienceGenderAges || audienceGenderAges.length === 0) {
    return ONE_X;
  }

  // Calculate total reported audience (across all buckets)
  const totalReported = audienceGenderAges.reduce((sum, bucket) => {
    return sum + Math.max(0, bucket.value ?? 0);
  }, 0);

  if (totalReported === 0) {
    return ONE_X;
  }

  // Weighted similarity score in [0, 1]
  // - Off-target ages contribute 0 (age gate)
  // - On-target ages contribute age baseline + optional gender bonus
  let weightedMatch = 0;

  for (const bucket of audienceGenderAges) {
    const value = Math.max(0, bucket.value ?? 0);
    if (value === 0) continue;

    const bucketWeight = value / totalReported;

    // Age gate: only target ages contribute
    const ageMatches = target.targetAgeRanges.some((r) => r === bucket.age);
    if (!ageMatches) {
      continue;
    }

    // Unknown gender gets no gender bonus (conservative)
    let normalizedGenderScore = 0;

    if (bucket.gender === "M") {
      normalizedGenderScore = normalizeGenderScore(target.genderWeights.M);
    } else if (bucket.gender === "F") {
      normalizedGenderScore = normalizeGenderScore(target.genderWeights.F);
    }

    // Inside target ages: score is age baseline + gender refinement (0..genderWeight)
    const bucketScore = ageWeight + normalizedGenderScore * genderWeight;

    weightedMatch += bucketWeight * bucketScore;
  }

  // Map weightedMatch to multiplier using bands
  let multiplier = DEMOGRAPHICS_MULTIPLIER.default;

  for (const band of DEMOGRAPHICS_MULTIPLIER.bands) {
    if (weightedMatch >= band.min && weightedMatch < band.max) {
      multiplier = band.mult;
      break;
    }
  }

  // Handle edge case: exactly 1.0 (or tiny floating overshoot)
  if (weightedMatch >= 1.0) {
    multiplier =
      DEMOGRAPHICS_MULTIPLIER.bands[DEMOGRAPHICS_MULTIPLIER.bands.length - 1]
        .mult;
  }

  // Convert to BPS and clamp
  const rawBps = Math.round(multiplier * ONE_X);
  const clampedBps = Math.max(
    DEMOGRAPHICS_BOUNDS.minBps,
    Math.min(DEMOGRAPHICS_BOUNDS.maxBps, rawBps)
  );

  return clampedBps;
}
