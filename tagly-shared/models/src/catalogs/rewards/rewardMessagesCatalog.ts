import { idxBy } from "../idxBy";
import type { Localized } from "../types";

// Messages the backend attaches to an estimated reward to explain why the
// number is high/low. Each entry is a slug + bilingual label; the backend
// emits slugs on the wire, the frontend renders via active i18n language.
// See useCatalogLocalizer.rewardMessageName(slug).
//
// `threshold` is optional and only meaningful for messages that fire when a
// multiplier dips below a certain bps. The threshold lives next to the
// label so the "when it fires" and "what it says" stay co-located. Adjust
// here, not in the backend helper.

export type RewardMessageDef = {
  slug: string;
  name: Localized;
  /** Multiplier bps below which this message fires (only used for the
   *  threshold-based messages; state-based messages like NO_STORY_VIEWS
   *  don't have one). */
  threshold?: number;
};

export const rewardMessages: RewardMessageDef[] = [
  {
    slug: "NO_INSTAGRAM",
    name: {
      en: "Instagram not connected: no rewards",
      cs: "Instagram není připojen: žádné odměny",
    },
  },
  {
    slug: "NO_STORY_VIEWS",
    name: {
      en: "Add your typical story views in Settings to see estimated rewards.",
      cs: "Odměny se zobrazí až v nastavení doplňíš počet zhlédnutí tvých stories.",
    },
  },
  {
    slug: "ESTIMATED_REACH",
    name: {
      en: "Estimated based on your story views",
      cs: "Odhad podle vyplněných zhlédnutí stories",
    },
  },
  {
    slug: "NO_SNAPSHOT",
    name: {
      en: "Setting up your account, higher rewards within a minute",
      cs: "Nastavujeme tvůj účet, odměny budou brzy vyšší",
    },
  },
  {
    slug: "GEO_TOO_FAR",
    name: {
      en: "Small audience in this area",
      cs: "Malé publikum v této oblasti",
    },
    threshold: 5000, // bps; "audience small" fires below 0.50×
  },
  {
    slug: "ACCOUNT_RATING_LOW",
    name: {
      en: "Low account rating",
      cs: "Špatné hodnocení účtu",
    },
    threshold: 7500, // bps; "rating low" fires below 0.75×
  },
  {
    slug: "LOW_FOLLOWER_RATIO",
    name: {
      en: "Low follower to following ratio",
      cs: "Nízký poměr sledujících k sledovaným",
    },
    threshold: 7500, // bps; "follower ratio low" fires below 0.75×
  },
  {
    slug: "FREQUENCY_SAME_BUSINESS_SAME_DAY",
    name: {
      en: "Already shared today",
      cs: "Už jsi tu dnes sdílel/a",
    },
  },
  {
    slug: "FREQUENCY_FREQUENT_DAY",
    name: {
      en: "Already shared another business today, higher rewards tomorrow",
      cs: "Už jsi dnes sdílel/a jiný podnik, vyšší odměny zítra",
    },
  },
  {
    slug: "FREQUENCY_FREQUENT_WEEK",
    name: {
      en: "Higher rewards in a few days (frequent sharing)",
      cs: "Za pár dní budou odměny vyšší (časté sdílení)",
    },
  },
  {
    slug: "BUDGET_LIMITED",
    name: {
      en: "Limited budget: reward capped at what this business can pay",
      cs: "Omezený rozpočet: odměna je zastropována tím, co může zaplatit",
    },
  },
];

export type RewardMessageSlug = (typeof rewardMessages)[number]["slug"];
export const rewardMessageBySlug = idxBy(rewardMessages);
export const rewardMessageSlugs = rewardMessages.map(
  (m) => m.slug,
) as RewardMessageSlug[];
