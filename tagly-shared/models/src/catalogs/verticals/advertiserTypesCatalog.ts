import { idxBy } from "../idxBy";
import type { Localized } from "../types";
import type { VerticalSlug } from "./verticalsCatalog";

export type AdvertiserTypeDef = {
  name: Localized;
  slug: string;
  verticalSlugs: VerticalSlug[];
  rewardMultiplierBps?: number; // optional override of vertical multiplier
  sortOrder?: number;
};

export const advertiserTypes: AdvertiserTypeDef[] = [
  // Catch-All
  {
    name: { en: "Other", cs: "Ostatní" },
    slug: "other",
    verticalSlugs: ["other"],
  },

  // Food & Drink
  {
    name: { en: "Restaurant", cs: "Restaurace" },
    slug: "restaurant",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Cafe", cs: "Kavárna" },
    slug: "cafe",
    verticalSlugs: ["food-drink"],
    // low margins, high volume — cafes shouldn't pay as much per post as
    // the rest of food & drink
    rewardMultiplierBps: 80_00,
  },
  {
    name: { en: "Bistro", cs: "Bistro" },
    slug: "bistro",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Smoothie Bar", cs: "Smoothie Bar" },
    slug: "juice-smoothie-bar",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Bakery", cs: "Pekařství" },
    slug: "bakery",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Ice Cream Shop", cs: "Zmrzlinárna" },
    slug: "ice-cream-shop",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Patisserie", cs: "Cukrárna" },
    slug: "patisserie",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Food Truck", cs: "Food Truck" },
    slug: "food-truck",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Brewery", cs: "Pivovar" },
    slug: "brewery",
    verticalSlugs: ["food-drink", "entertainment"],
    rewardMultiplierBps: 105_00,
  },
  {
    name: { en: "Winery", cs: "Vinařství" },
    slug: "winery",
    verticalSlugs: ["food-drink", "travel-hospitality"],
    rewardMultiplierBps: 110_00,
  },
  {
    name: { en: "Bar", cs: "Bar" },
    slug: "bar",
    verticalSlugs: ["food-drink", "entertainment"],
    rewardMultiplierBps: 105_00,
  },
  {
    name: { en: "Shisha Lounge", cs: "Shisha Lounge" },
    slug: "shisha-lounge",
    verticalSlugs: ["food-drink", "entertainment"],
    rewardMultiplierBps: 105_00,
  },
  {
    name: { en: "Nightclub", cs: "Noční Klub" },
    slug: "nightclub",
    verticalSlugs: ["entertainment", "food-drink"],
    rewardMultiplierBps: 105_00,
  },

  // Retail
  {
    name: { en: "Thrift / Vintage Store", cs: "Second Hand / Vintage Obchod" },
    slug: "thrift-vintage-store",
    verticalSlugs: ["fashion", "retail", "lifestyle-hobbies"],
  },

  // Beauty & Wellness
  {
    name: { en: "Hair Salon", cs: "Kadeřnictví" },
    slug: "hair-salon",
    verticalSlugs: ["beauty-wellness"],
  },
  {
    name: {
      en: "Tattoo & Piercing Studio",
      cs: "Tetovací / Piercingové Studio",
    },
    slug: "tattoo-piercing-studio",
    verticalSlugs: ["beauty-wellness"],
    rewardMultiplierBps: 110_00,
  },
  {
    name: { en: "Barbershop", cs: "Barber Shop" },
    slug: "barbershop",
    verticalSlugs: ["beauty-wellness"],
  },
  {
    name: { en: "Nail Salon", cs: "Nail Salon" },
    slug: "nail-salon",
    verticalSlugs: ["beauty-wellness"],
  },
  {
    name: { en: "Wellness Center", cs: "Wellness Centrum" },
    slug: "wellness-center",
    verticalSlugs: ["beauty-wellness"],
  },

  // Sports & Fitness
  {
    name: { en: "Gym", cs: "Gym" },
    slug: "gym",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Yoga Studio", cs: "Yoga Studio" },
    slug: "yoga-studio",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Pilates Studio", cs: "Pilates Studio" },
    slug: "pilates-studio",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Climbing Gym", cs: "Lezecká Stěna" },
    slug: "climbing-gym",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Tennis Court", cs: "Tenisový Kurt" },
    slug: "tennis-court",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Padel Court", cs: "Padelový Kurt" },
    slug: "padel-court",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Sports Club", cs: "Sportoviště" },
    slug: "sports-club",
    verticalSlugs: ["sports-fitness"],
  },

  // Entertainment (campaign types)
  {
    name: { en: "Theater", cs: "Divadlo" },
    slug: "theater",
    verticalSlugs: ["entertainment"],
  },
  {
    name: { en: "Movie Theater", cs: "Kino" },
    slug: "movie-theater",
    verticalSlugs: ["entertainment"],
  },
  {
    name: { en: "Bowling Alley", cs: "Bowling" },
    slug: "bowling-alley",
    verticalSlugs: ["entertainment", "sports-fitness"],
  },
  {
    name: { en: "Mini Golf", cs: "Mini Golf" },
    slug: "mini-golf",
    verticalSlugs: ["sports-fitness", "entertainment"],
  },
  {
    name: { en: "Arcade", cs: "Arkády" },
    slug: "arcade",
    verticalSlugs: ["entertainment"],
  },
  {
    name: { en: "Escape Room", cs: "Únikovka" },
    slug: "escape-room",
    verticalSlugs: ["entertainment", "lifestyle-hobbies"],
  },
  {
    name: { en: "Laser Tag", cs: "Laser Game" },
    slug: "laser-tag",
    verticalSlugs: ["entertainment", "sports-fitness"],
  },
  {
    name: { en: "Amusement Park", cs: "Zábavní Park" },
    slug: "amusement-park",
    verticalSlugs: ["entertainment", "travel-hospitality"],
  },
  {
    name: { en: "Zoo", cs: "Zoo" },
    slug: "zoo",
    verticalSlugs: ["entertainment", "lifestyle-hobbies"],
  },
  {
    name: { en: "Aquarium", cs: "Akvárium" },
    slug: "aquarium",
    verticalSlugs: ["entertainment"],
  },

  // Lifestyle & Hobbies
  {
    name: { en: "Pet Services", cs: "Služby pro mazlíčky" },
    slug: "pet-services",
    verticalSlugs: ["lifestyle-hobbies"],
  },
  {
    name: { en: "Coworking Space", cs: "Cowork" },
    slug: "coworking-space",
    verticalSlugs: ["lifestyle-hobbies"],
  },
];

export type AdvertiserTypeSlug = (typeof advertiserTypes)[number]["slug"];
export const advertiserTypeBySlug = idxBy(advertiserTypes);
export const advertiserTypeSlugs = advertiserTypes.map(
  (t) => t.slug,
) as AdvertiserTypeSlug[];
