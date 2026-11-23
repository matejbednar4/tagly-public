import { SubaccountStatus } from "../../generated/prisma/client.js";
import { generateUid } from "../../utils/core/uids/generateUid.js";
import { getTimezoneForCoordinates } from "../../utils/geo/getTimezoneForCoordinates.js";
import prisma from "../../prisma/prisma.js";
import { uploadSeedAssetToS3 } from "./uploadSeedAssetToS3.js";
import { bucketPrefix } from "./bucketPrefix.js";

/**
 * Seed Data Plan (single-account dev seed — everything in Prague):
 *
 * Advertiser (matej@taglyapp.com) — CZ, Prague — owns 9 ACTIVE pages:
 *   Italian Corner, Sushi Garden, Grind Gym, Sauna World, Letná Tennis Club,
 *   Good Morning Cafe, Flow Yoga, Gentlemen's Cut, Bloom Cafe
 *
 * Platform-subsidized (no advertiser, open SubsidizationPeriod) — 3 ACTIVE:
 *   Karlin Espresso, Riverside Brunch, Core Pilates
 *
 * All 12 are ACTIVE + Prague so every one is visible + shareable to the seeded
 * customer. Banner keys reuse existing seed assets so images render. Shares are
 * seeded against these in shares.ts.
 */

const CITY_CENTERS = {
  prague: { lat: 50.0755, lon: 14.4378 },
};

type SubaccountSeed = {
  /** Omit for subsidized locals (advertiserId will be null) */
  advertiserEmail?: string;
  /** true = no advertiser, creates an open SubsidizationPeriod */
  subsidized?: boolean;
  kind: "LOCAL";
  name: string;
  typeSlug: string;
  bannerKey: string;
  address: {
    country: string;
    /** ISO 3166-1 alpha-2 country code (e.g. "US", "CZ") */
    countryCode: string;
    region: string;
    city: string;
    zip: string;
    street: string;
    lat: number;
    lon: number;
    cityLocation: { lat: number; lon: number };
  };
  uid: string;
  status: SubaccountStatus;
  instagramTag?: string;
  /** Optional detail-page copy (the "about" blurb on the business page). */
  description?: string;
  /** Public contact email shown on the business detail page. */
  contactEmail?: string;
};

const prg = (
  street: string,
  zip: string,
  lat: number,
  lon: number,
): SubaccountSeed["address"] => ({
  country: "Czech Republic",
  countryCode: "CZ",
  region: "Prague",
  city: "Prague",
  zip,
  street,
  lat,
  lon,
  cityLocation: CITY_CENTERS.prague,
});

export const SUBACCOUNTS: SubaccountSeed[] = [
  // ============================================================
  // ADVERTISER: matej@taglyapp.com — CZ, Prague — 8 owned pages
  // ============================================================
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "restaurant",
    name: "Italian Corner",
    bannerKey: `${bucketPrefix}public/seed/italian.jpg`,
    address: prg("Karlova 8", "11000", 50.0782, 14.4378),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "restaurant",
    name: "Sushi Garden",
    bannerKey: `${bucketPrefix}public/seed/sushi.jpg`,
    address: prg(
      "Vinohradská 30",
      "12000",
      50.18989738429284,
      14.111449713320784,
    ),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "gym",
    name: "Grind Gym",
    bannerKey: `${bucketPrefix}public/seed/gym.jpg`,
    // ~1.4km north (Holešovice) — Bloom-line screenshot spacing, see Good Morning.
    address: prg("Jankovcova 14", "17000", 50.1041, 14.4495),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "wellness-center",
    name: "Sauna World",
    bannerKey: `${bucketPrefix}public/seed/sauna.jpg`,
    address: prg("Národní 25", "11000", 50.0818, 14.4189),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "tennis-court",
    name: "Letná Tennis Club",
    bannerKey: `${bucketPrefix}public/seed/tennis.jpg`,
    address: prg("Letenské sady 1", "17000", 50.0951, 14.4185),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "cafe",
    name: "Good Morning Cafe",
    bannerKey: `${bucketPrefix}public/seed/coffee-2.jpg`,
    // ~1.4km north of the old spot (Letná) — keeps Bloom Cafe alone on its
    // horizontal map line for screenshots (2026-08-03; lon deliberately kept).
    address: prg("Veletržní 24", "17000", 50.1025, 14.4256),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "yoga-studio",
    name: "Flow Yoga",
    bannerKey: `${bucketPrefix}public/seed/yoga.jpg`,
    address: prg("Korunní 50", "12000", 50.076, 14.445),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "barbershop",
    name: "Gentlemen's Cut",
    bannerKey: `${bucketPrefix}public/seed/barber.jpg`,
    // ~1.1km north (Letná) — Bloom-line screenshot spacing, see Good Morning.
    address: prg("Milady Horákové 38", "17000", 50.1005, 14.431),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },

  // ============================================================
  // PLATFORM-SUBSIDIZED — no advertiser, open SubsidizationPeriod
  // ============================================================
  {
    subsidized: true,
    kind: "LOCAL",
    typeSlug: "cafe",
    name: "Karlin Espresso",
    bannerKey: `${bucketPrefix}public/seed/coffee.jpg`,
    // ~1.3km south (Žižkov) — Bloom-line screenshot spacing, see Good Morning.
    address: prg("Ondříčkova 17", "13000", 50.0813, 14.452),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    advertiserEmail: "matej@taglyapp.com",
    kind: "LOCAL",
    typeSlug: "cafe",
    name: "Bloom Cafe",
    bannerKey: `${bucketPrefix}public/seed/brunch.jpg`,
    address: prg("Hybernská 10", "11000", 50.0875, 14.433),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "bloomcafe__",
    description:
      "A light filled neighbourhood cafe just off Hybernská. We roast our own beans, bake everything in house every morning, and keep the back room quiet for anyone who wants to sit with a flat white and a book.",
    contactEmail: "hello@bloomcafe.com",
  },
  {
    subsidized: true,
    kind: "LOCAL",
    typeSlug: "restaurant",
    name: "Riverside Brunch",
    bannerKey: `${bucketPrefix}public/seed/brunch-2.jpg`,
    // ~1.1km south (Na Slupi / Albertov) — Bloom-line screenshot spacing.
    address: prg("Na Slupi 14", "12800", 50.0768, 14.432),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
  {
    subsidized: true,
    kind: "LOCAL",
    typeSlug: "pilates-studio",
    name: "Core Pilates",
    bannerKey: `${bucketPrefix}public/seed/pilates.jpg`,
    address: prg("Jungmannova 14", "11000", 50.082, 14.422),
    status: "ACTIVE",
    uid: generateUid("LOCAL_SUBACCOUNT"),
    instagramTag: "test",
  },
];

async function createAddressWithPoint(
  country: string,
  countryCode: string,
  region: string | null,
  city: string,
  zip: string,
  street: string,
  lat: number,
  lon: number,
  cityLat: number,
  cityLon: number,
): Promise<number> {
  const timezone = getTimezoneForCoordinates(lat, lon);
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO "app"."addresses"
      ("country","country_code","region","city","zip","street","timezone","location","city_location","created_at","updated_at")
    VALUES (
      ${country},
      ${countryCode},
      ${region},
      ${city},
      ${zip},
      ${street},
      ${timezone},
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${cityLon}, ${cityLat}), 4326)::geography,
      NOW(), NOW()
    )
    RETURNING id;
  `;

  if (!rows?.[0]?.id) {
    throw new Error(`Failed to create Address for ${street}, ${city}`);
  }
  return rows[0].id;
}

async function createBannerMedia(key: string) {
  // Upload the banner so it renders. Banner keys aren't namespaced, so the local
  // source is the key's `public/seed/` suffix (e.g. `.../public/seed/italian.jpg`
  // → `italian.jpg`).
  const marker = "public/seed/";
  const sourceRelPath = key.slice(key.indexOf(marker) + marker.length);
  await uploadSeedAssetToS3(sourceRelPath, key);

  return prisma.media.create({
    data: {
      uid: generateUid("MEDIA"),
      aspectRatio: 1.7778,
      type: "IMAGE",
      width: 1920,
      height: 1080,
      key,
      mime: "image/jpeg",
    },
  });
}

async function main() {
  console.log(`Seeding ${SUBACCOUNTS.length} subaccounts...`);

  for (const s of SUBACCOUNTS) {
    const type = await prisma.advertiserType.findUnique({
      where: { slug: s.typeSlug },
      select: { id: true },
    });
    if (!type) {
      throw new Error(`AdvertiserType not found for slug: ${s.typeSlug}`);
    }

    let advertiserId: number | null = null;
    if (!s.subsidized) {
      if (!s.advertiserEmail) {
        throw new Error(
          `Non-subsidized local "${s.name}" requires advertiserEmail`,
        );
      }
      const adv = await prisma.advertiser.findUnique({
        where: { email: s.advertiserEmail },
        select: { id: true },
      });
      if (!adv) {
        throw new Error(`Advertiser not found: ${s.advertiserEmail}`);
      }
      advertiserId = adv.id;
    }

    const banner = await createBannerMedia(s.bannerKey);

    const addressId = await createAddressWithPoint(
      s.address.country,
      s.address.countryCode,
      s.address.region || null,
      s.address.city,
      s.address.zip,
      s.address.street,
      s.address.lat,
      s.address.lon,
      s.address.cityLocation.lat,
      s.address.cityLocation.lon,
    );

    const local = await prisma.localSubaccount.create({
      data: {
        uid: s.uid,
        name: s.name,
        instagramTag: s.instagramTag ?? null,
        description: s.description ?? null,
        contactEmail: s.contactEmail ?? null,
        bannerId: banner.id,
        advertiserId,
        typeId: type.id,
        addressId,
        status: s.status,
      },
    });

    if (s.subsidized) {
      await prisma.subsidizationPeriod.create({
        data: { localId: local.id },
      });
      console.log(
        `Created subsidized LOCAL "${s.name}" (${s.typeSlug}) in ${s.address.city}`,
      );
    } else {
      console.log(
        `Created LOCAL "${s.name}" (${s.typeSlug}, ${s.status}) in ${s.address.city} for ${s.advertiserEmail}`,
      );
    }
  }

  console.log(`\nDone! Created ${SUBACCOUNTS.length} subaccounts.`);
}

export { main as seedBusinessPages };

const isDirectExecution =
  process.argv[1]?.includes("businessPages.ts") ||
  process.argv[1]?.includes("businessPages.js");
if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error("Business pages seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
