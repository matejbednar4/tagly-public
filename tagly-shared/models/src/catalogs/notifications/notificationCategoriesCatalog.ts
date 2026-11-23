import { idxBy } from "../idxBy";
import type { Localized } from "../types";

// Categories grouping in-app notification settings. The DB has rows that
// reference these slugs; display labels + descriptions live only here.
// The backend emits slugs on the wire (+ a deprecated English `name` for
// old mobile builds); new clients resolve labels via useCatalogLocalizer.

export type NotificationCategoryDef = {
  slug: string;
  name: Localized;
  customerDescription?: Localized;
  advertiserDescription?: Localized;
  sortOrder: number;
};

export const notificationCategories: NotificationCategoryDef[] = [
  {
    slug: "balance",
    name: { en: "Balance Changes", cs: "Změny zůstatku" },
    customerDescription: {
      en: "When you earn or withdraw money.",
      cs: "Když vyděláš nebo si vybereš peníze.",
    },
    advertiserDescription: {
      en: "When you purchase credits or pay for a share.",
      cs: "Když nakupuješ kredity nebo platíš za sdílení.",
    },
    sortOrder: 1,
  },
  {
    slug: "account",
    name: { en: "Account", cs: "Účet" },
    customerDescription: {
      en: "When your account is updated.",
      cs: "Když dojde ke změně tvého účtu.",
    },
    advertiserDescription: {
      en: "When your account is updated.",
      cs: "Když dojde ke změně tvého účtu.",
    },
    sortOrder: 2,
  },
  {
    slug: "shares",
    name: { en: "Shares", cs: "Sdílení" },
    customerDescription: {
      en: "Updates about your shared posts and ratings.",
      cs: "Novinky o tvých sdílených příspěvcích a hodnocení.",
    },
    advertiserDescription: {
      en: "When someone shares your business/work.",
      cs: "Když někdo sdílí tvůj podnik nebo tvoji práci.",
    },
    sortOrder: 3,
  },
  {
    slug: "reminders",
    name: { en: "Reminders", cs: "Připomenutí" },
    customerDescription: {
      en: "Friendly nudges to keep sharing and earning.",
      cs: "Přátelská připomenutí, ať dál sdílíš a vyděláváš.",
    },
    advertiserDescription: {
      en: "Reminders to rate shares or top up your budget.",
      cs: "Připomenutí, abys ohodnotil/a sdílení nebo dobil/a rozpočet.",
    },
    sortOrder: 4,
  },
  {
    slug: "performance",
    name: { en: "Performance Insights", cs: "Statistiky výkonu" },
    customerDescription: {
      en: "See earnings and share performance.",
      cs: "Sleduj výdělky a výkon svých sdílení.",
    },
    advertiserDescription: {
      en: "Insights on reach, engagement, and spending.",
      cs: "Přehled o dosahu, interakcích a útratě.",
    },
    sortOrder: 5,
  },
  {
    slug: "referrals",
    name: { en: "Referrals", cs: "Doporučení" },
    customerDescription: {
      en: "When friends join using your code.",
      cs: "Když se kamarádi přidají s tvým kódem.",
    },
    advertiserDescription: {
      en: "When new businesses join via your invite.",
      cs: "Když se podle tvého pozvání přidají nové podniky.",
    },
    sortOrder: 6,
  },
  {
    slug: "milestones",
    name: { en: "Milestones", cs: "Milníky" },
    customerDescription: {
      en: "Celebrate achievements (e.g., 10 payouts).",
      cs: "Oslav své úspěchy (např. 10 výplat).",
    },
    advertiserDescription: {
      en: "Celebrate share milestones for your business.",
      cs: "Oslav milníky sdílení tvého podniku.",
    },
    sortOrder: 7,
  },
  {
    slug: "security",
    name: { en: "Security", cs: "Bezpečnost" },
    customerDescription: {
      en: "Logins and account protection alerts.",
      cs: "Upozornění na přihlášení a ochranu účtu.",
    },
    advertiserDescription: {
      en: "Account safety updates.",
      cs: "Aktualizace ohledně bezpečnosti účtu.",
    },
    sortOrder: 8,
  },
  {
    slug: "legal",
    name: { en: "Legal & Compliance", cs: "Právní informace" },
    customerDescription: {
      en: "Important legal and privacy updates.",
      cs: "Důležité právní a soukromé novinky.",
    },
    advertiserDescription: {
      en: "Policy or compliance notices.",
      cs: "Změny pravidel a právních podmínek.",
    },
    sortOrder: 9,
  },
  {
    slug: "announcements",
    name: { en: "Announcements", cs: "Oznámení" },
    customerDescription: {
      en: "News and updates from Tagly.",
      cs: "Novinky a oznámení od Tagly.",
    },
    advertiserDescription: {
      en: "Product news and updates.",
      cs: "Novinky a aktualizace produktu.",
    },
    sortOrder: 10,
  },
  {
    slug: "promo",
    name: { en: "Promotions", cs: "Promo" },
    customerDescription: {
      en: "Special offers, bonuses, and deals.",
      cs: "Speciální nabídky, bonusy a akce.",
    },
    advertiserDescription: {
      en: "Marketing tips and partner promotions.",
      cs: "Marketingové tipy a partnerské akce.",
    },
    sortOrder: 1000,
  },
];

export type NotificationCategorySlug =
  (typeof notificationCategories)[number]["slug"];
export const notificationCategoryBySlug = idxBy(notificationCategories);
export const notificationCategorySlugs = notificationCategories.map(
  (c) => c.slug,
) as NotificationCategorySlug[];
