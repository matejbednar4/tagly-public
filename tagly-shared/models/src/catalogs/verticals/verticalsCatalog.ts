import { idxBy } from "../idxBy";
import type { Localized } from "../types";

export type VerticalDef = {
  name: Localized;
  slug: string;
  rewardMultiplierBps: number; // 100_00 for 1.0x multiplier or 165_00 for 1.65x multiplier
  sortOrder: number;
};

// Only verticals that are actually referenced by a surviving advertiser type
// AND a surviving customer interest are kept. Removed (no longer used by the
// trimmed type/interest catalogs): automotive, finance-insurance, home-real-estate,
// non-profit-community, technology-electronics, education, health-medical.
// See [tagly-backend/prisma/migrations/.../migration.sql] for the DB cleanup.

export const verticals: VerticalDef[] = [
  {
    name: { en: "Other", cs: "Ostatní" },
    slug: "other",
    rewardMultiplierBps: 100_00,
    sortOrder: 1000,
  },
  {
    name: { en: "Food & Drink", cs: "Jídlo a Pití" },
    slug: "food-drink",
    rewardMultiplierBps: 100_00,
    sortOrder: 1,
  },
  {
    name: { en: "Sports & Fitness", cs: "Sport a Fitness" },
    slug: "sports-fitness",
    rewardMultiplierBps: 105_00,
    sortOrder: 2,
  },
  {
    name: { en: "Entertainment", cs: "Zábava" },
    slug: "entertainment",
    rewardMultiplierBps: 105_00,
    sortOrder: 3,
  },
  {
    name: { en: "Fashion", cs: "Móda" },
    slug: "fashion",
    rewardMultiplierBps: 105_00,
    sortOrder: 4,
  },
  {
    name: { en: "Beauty & Wellness", cs: "Krása a Wellness" },
    slug: "beauty-wellness",
    rewardMultiplierBps: 110_00,
    sortOrder: 5,
  },
  {
    name: { en: "Lifestyle & Hobbies", cs: "Životní Styl a Koníčky" },
    slug: "lifestyle-hobbies",
    rewardMultiplierBps: 105_00,
    sortOrder: 6,
  },
  {
    name: { en: "Travel & Hospitality", cs: "Cestování a Pohostinství" },
    slug: "travel-hospitality",
    rewardMultiplierBps: 110_00,
    sortOrder: 7,
  },
  {
    name: { en: "Retail", cs: "Maloobchod" },
    slug: "retail",
    rewardMultiplierBps: 100_00,
    sortOrder: 8,
  },
];

export type VerticalSlug = (typeof verticals)[number]["slug"];

export const verticalBySlug = idxBy(verticals);
export const verticalSlugs = verticals.map((v) => v.slug) as VerticalSlug[];
