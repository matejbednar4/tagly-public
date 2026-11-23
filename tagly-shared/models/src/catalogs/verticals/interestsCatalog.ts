import { idxBy } from "../idxBy";
import type { Localized } from "../types";
import type { VerticalSlug } from "./verticalsCatalog";

export type InterestDef = {
  name: Localized;
  slug: string;
  verticalSlugs: VerticalSlug[];
  sortOrder?: number;
};

export const customerInterests: InterestDef[] = [
  // Food & Drink
  {
    name: { en: "Food & Dining", cs: "Jídlo a Restaurace" },
    slug: "food-dining",
    verticalSlugs: ["food-drink"],
  },
  {
    name: { en: "Cafe Culture", cs: "Kavárny a Cukrárny" },
    slug: "cafe-culture",
    verticalSlugs: ["food-drink", "lifestyle-hobbies"],
  },
  {
    name: { en: "Bars & Nightlife", cs: "Noční Život" },
    slug: "bars-nightlife",
    verticalSlugs: ["food-drink", "entertainment"],
  },
  {
    name: { en: "Beer & Wine", cs: "Pivo a Víno" },
    slug: "beer-wine",
    verticalSlugs: ["food-drink"],
  },

  // Beauty & Wellness
  {
    name: { en: "Hair & Barbering", cs: "Vlasy a Holičství" },
    slug: "hair-barbering",
    verticalSlugs: ["beauty-wellness"],
  },
  {
    name: { en: "Beauty & Spa", cs: "Krása a Spa" },
    slug: "beauty-spa",
    verticalSlugs: ["beauty-wellness"],
  },
  {
    name: { en: "Tattoo & Piercing", cs: "Tetování a Piercing" },
    slug: "tattoo-piercing",
    verticalSlugs: ["beauty-wellness"],
  },

  // Sports & Fitness
  {
    name: { en: "Gym & Fitness", cs: "Posilovna a Fitness" },
    slug: "gym-fitness",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Yoga", cs: "Yoga" },
    slug: "yoga",
    verticalSlugs: ["sports-fitness", "beauty-wellness"],
  },
  {
    name: { en: "Pilates", cs: "Pilates" },
    slug: "pilates",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Climbing", cs: "Lezení" },
    slug: "climbing",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Tennis", cs: "Tenis" },
    slug: "tennis",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Padel", cs: "Padel" },
    slug: "padel",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Running", cs: "Běhání" },
    slug: "running",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Cycling", cs: "Cyklistika" },
    slug: "cycling",
    verticalSlugs: ["sports-fitness", "lifestyle-hobbies"],
  },
  {
    name: { en: "Martial Arts", cs: "Bojové Sporty" },
    slug: "martial-arts",
    verticalSlugs: ["sports-fitness"],
  },
  {
    name: { en: "Hiking & Outdoors", cs: "Turistika a Příroda" },
    slug: "hiking-outdoors",
    verticalSlugs: ["sports-fitness", "travel-hospitality"],
  },

  // Entertainment
  {
    name: { en: "Cinema & Film", cs: "Kino a Film" },
    slug: "cinema-film",
    verticalSlugs: ["entertainment"],
  },
  {
    name: { en: "Theater & Performing Arts", cs: "Divadlo" },
    slug: "theater-performing-arts",
    verticalSlugs: ["entertainment", "lifestyle-hobbies"],
  },
  {
    name: { en: "Fun & Activities", cs: "Zábava a Aktivity" },
    slug: "fun-activities",
    verticalSlugs: ["entertainment", "lifestyle-hobbies"],
  },

  // Retail & Lifestyle
  {
    name: { en: "Fashion", cs: "Móda" },
    slug: "fashion",
    verticalSlugs: ["fashion", "retail"],
  },
  {
    name: { en: "Pets", cs: "Mazlíčci" },
    slug: "pets",
    verticalSlugs: ["lifestyle-hobbies"],
  },
];

export type InterestSlug = (typeof customerInterests)[number]["slug"];
export const interestBySlug = idxBy(customerInterests);
export const interestSlugs = customerInterests.map(
  (i) => i.slug,
) as InterestSlug[];
