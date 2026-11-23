import type { AdvertiserTypeSlug } from "@tagly/models/shared";

// Age buckets returned by Instagram API
export type AgeRange =
  | "13-17"
  | "18-24"
  | "25-34"
  | "35-44"
  | "45-54"
  | "55-64"
  | "65+";

// Gender weights: 1.0 = neutral, >1.0 = preferred, <1.0 = less preferred
export type GenderWeights = {
  M: number;
  F: number;
};

export type TargetDemographicsDef = {
  typeSlug: AdvertiserTypeSlug;
  targetAgeRanges: AgeRange[];
  genderWeights: GenderWeights;
};

// Neutral weights for convenience
const NEUTRAL: GenderWeights = { M: 1.0, F: 1.0 };

// Common demographic patterns
const FEMALE_SKEW_LIGHT: GenderWeights = { M: 0.8, F: 1.2 };
const FEMALE_SKEW_MODERATE: GenderWeights = { M: 0.6, F: 1.4 };
const FEMALE_SKEW_STRONG: GenderWeights = { M: 0.4, F: 1.6 };
const MALE_SKEW_LIGHT: GenderWeights = { M: 1.2, F: 0.8 };
const MALE_SKEW_MODERATE: GenderWeights = { M: 1.4, F: 0.6 };

// Common age ranges (keep these broad to avoid over-penalizing with the age gate)
const TEEN_AND_UP: AgeRange[] = ["13-17", "18-24", "25-34", "35-44", "45-54"];
const YOUNG_ADULT: AgeRange[] = ["18-24", "25-34"];
const YOUNG_TO_MIDDLE: AgeRange[] = ["18-24", "25-34", "35-44"];
const ADULT: AgeRange[] = ["25-34", "35-44", "45-54"];
const BROAD_ADULT: AgeRange[] = ["18-24", "25-34", "35-44", "45-54"];
const FAMILY_AGE: AgeRange[] = ["25-34", "35-44", "45-54"];

export const advertiserTypeTargetDemographics: TargetDemographicsDef[] = [
  // ===== CATCH-ALL =====
  {
    typeSlug: "other",
    targetAgeRanges: BROAD_ADULT,
    genderWeights: NEUTRAL,
  },

  // ===== FOOD & DRINK =====
  {
    typeSlug: "restaurant",
    targetAgeRanges: BROAD_ADULT,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "cafe",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    // Between cafe and restaurant — brunch/lunch spots with a young, IG-active crowd
    typeSlug: "bistro",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "juice-smoothie-bar",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "bakery",
    targetAgeRanges: FAMILY_AGE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "patisserie",
    targetAgeRanges: FAMILY_AGE,
    genderWeights: FEMALE_SKEW_MODERATE,
  },
  {
    // Family + young consumers
    typeSlug: "ice-cream-shop",
    targetAgeRanges: TEEN_AND_UP,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "food-truck",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "brewery",
    targetAgeRanges: ADULT,
    genderWeights: MALE_SKEW_LIGHT,
  },
  {
    typeSlug: "winery",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "bar",
    targetAgeRanges: YOUNG_ADULT,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "shisha-lounge",
    targetAgeRanges: YOUNG_ADULT,
    genderWeights: MALE_SKEW_LIGHT,
  },
  {
    // Younger skew vs bar
    typeSlug: "nightclub",
    targetAgeRanges: YOUNG_ADULT,
    genderWeights: NEUTRAL,
  },

  // ===== FASHION & RETAIL =====
  {
    typeSlug: "thrift-vintage-store",
    targetAgeRanges: YOUNG_ADULT,
    genderWeights: FEMALE_SKEW_LIGHT,
  },

  // ===== BEAUTY & WELLNESS =====
  {
    typeSlug: "hair-salon",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: FEMALE_SKEW_MODERATE,
  },
  {
    typeSlug: "tattoo-piercing-studio",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "barbershop",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: MALE_SKEW_MODERATE,
  },
  {
    typeSlug: "nail-salon",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: FEMALE_SKEW_STRONG,
  },
  {
    typeSlug: "wellness-center",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_LIGHT,
  },

  // ===== SPORTS & FITNESS =====
  {
    typeSlug: "gym",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "yoga-studio",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_MODERATE,
  },
  {
    typeSlug: "pilates-studio",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_STRONG,
  },
  {
    typeSlug: "climbing-gym",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: MALE_SKEW_LIGHT,
  },
  {
    typeSlug: "tennis-court",
    targetAgeRanges: BROAD_ADULT,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "padel-court",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "sports-club",
    targetAgeRanges: BROAD_ADULT,
    genderWeights: NEUTRAL,
  },

  // ===== ENTERTAINMENT =====
  {
    typeSlug: "theater",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "movie-theater",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },

  // ===== LEISURE ACTIVITIES =====
  {
    typeSlug: "bowling-alley",
    targetAgeRanges: TEEN_AND_UP,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "mini-golf",
    targetAgeRanges: TEEN_AND_UP,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "arcade",
    targetAgeRanges: ["13-17", "18-24", "25-34", "35-44"],
    genderWeights: MALE_SKEW_LIGHT,
  },
  {
    typeSlug: "escape-room",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "laser-tag",
    targetAgeRanges: ["13-17", "18-24", "25-34", "35-44"],
    genderWeights: MALE_SKEW_LIGHT,
  },
  {
    typeSlug: "amusement-park",
    targetAgeRanges: TEEN_AND_UP,
    genderWeights: NEUTRAL,
  },
  {
    typeSlug: "zoo",
    targetAgeRanges: FAMILY_AGE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "aquarium",
    targetAgeRanges: FAMILY_AGE,
    genderWeights: FEMALE_SKEW_LIGHT,
  },

  // ===== LIFESTYLE =====
  {
    typeSlug: "pet-services",
    targetAgeRanges: ADULT,
    genderWeights: FEMALE_SKEW_LIGHT,
  },
  {
    typeSlug: "coworking-space",
    targetAgeRanges: YOUNG_TO_MIDDLE,
    genderWeights: NEUTRAL,
  },
];

// Build fast lookup map
const targetDemoBySlug = new Map<string, TargetDemographicsDef>();
for (const def of advertiserTypeTargetDemographics) {
  targetDemoBySlug.set(def.typeSlug, def);
}

/**
 * Get target demographics for a business type.
 * Returns null if the type has no target demographics defined.
 */
export function getTargetDemographics(
  typeSlug: string
): TargetDemographicsDef | null {
  return targetDemoBySlug.get(typeSlug) ?? null;
}
