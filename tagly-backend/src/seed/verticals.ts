import {
  verticals,
  advertiserTypes,
  customerInterests,
} from "@tagly/models/shared";
import prisma from "../prisma/prisma.js";

// Catalog labels live in @tagly/models — the DB has no `name` column. The
// seeder only writes structural fields (id/slug/scope/multipliers/ordering/
// joins). Display names are composed from the shared catalog at response
// time (see tagly-backend/src/utils/i18n/localizeCatalog.ts).
export async function seedVerticals() {
  console.log("Seeding verticals...");

  // NOTE: reward multipliers are deliberately not persisted — the pricers read
  // them straight from the compiled catalogs (calculateTypeBps), so the old DB
  // copies were write-only and were dropped (algo v11). Only structural data
  // (slug, ordering, joins) is seeded.
  for (const v of verticals) {
    await prisma.vertical.upsert({
      where: { slug: v.slug },
      update: {
        sortOrder: v.sortOrder,
      },
      create: {
        slug: v.slug,
        sortOrder: v.sortOrder,
      },
    });
  }

  console.log("Finished seeding verticals. Validating referenced slugs...");

  // Validate vertical slug references BEFORE upserting types/interests.
  const dbVerticalSlugs = new Set(
    (await prisma.vertical.findMany({ select: { slug: true } })).map(
      (v) => v.slug,
    ),
  );

  const missingForTypes = new Map<string, string[]>();
  for (const t of advertiserTypes) {
    const missing = t.verticalSlugs.filter((s) => !dbVerticalSlugs.has(s));
    if (missing.length) missingForTypes.set(t.slug, missing);
  }

  const missingForInterests = new Map<string, string[]>();
  for (const i of customerInterests) {
    const missing = i.verticalSlugs.filter((s) => !dbVerticalSlugs.has(s));
    if (missing.length) missingForInterests.set(i.slug, missing);
  }

  if (missingForTypes.size || missingForInterests.size) {
    const parts: string[] = [];
    if (missingForTypes.size) {
      parts.push(
        "Missing vertical slugs referenced by advertiser types:\n" +
          [...missingForTypes.entries()]
            .map(([typeSlug, slugs]) => `  • ${typeSlug}: ${slugs.join(", ")}`)
            .join("\n"),
      );
    }
    if (missingForInterests.size) {
      parts.push(
        "Missing vertical slugs referenced by interests:\n" +
          [...missingForInterests.entries()]
            .map(
              ([interestSlug, slugs]) =>
                `  • ${interestSlug}: ${slugs.join(", ")}`,
            )
            .join("\n"),
      );
    }
    throw new Error(parts.join("\n\n"));
  }

  console.log("Slug validation passed. Seeding advertiser types...");


  for (const t of advertiserTypes) {
    await prisma.advertiserType.upsert({
      where: { slug: t.slug },
      update: {
        sortOrder: t.sortOrder,
        verticals: {
          set: [],
          connect: t.verticalSlugs.map((slug) => ({ slug })),
        },
      },
      create: {
        slug: t.slug,
        sortOrder: t.sortOrder,
        verticals: {
          connect: t.verticalSlugs.map((slug) => ({ slug })),
        },
      },
    });
  }

  console.log("Finished seeding advertiser types, Seeding interests...");

  for (const i of customerInterests) {
    await prisma.interest.upsert({
      where: { slug: i.slug },
      update: {
        sortOrder: i.sortOrder,
        verticals: {
          set: [],
          connect: i.verticalSlugs.map((slug) => ({ slug })),
        },
      },
      create: {
        slug: i.slug,
        sortOrder: i.sortOrder,
        verticals: {
          connect: i.verticalSlugs.map((slug) => ({ slug })),
        },
      },
    });
  }

  console.log("Finished seeding interests. Validating DB ↔ catalog alignment...");

  // Inverse-direction check: every DB row must have a matching slug in the
  // shared catalog. The migration cleans orphan rows before this runs, so
  // this is a tripwire for future drift — e.g. a deploy that shipped a new
  // catalog without the corresponding schema migration, or someone inserting
  // a row manually. Without a catalog entry the FE has no display name for
  // the row, so we'd rather fail startup loudly than silently render slugs.
  const [dbVerticalSlugList, dbTypeSlugList, dbInterestSlugList] =
    await Promise.all([
      prisma.vertical.findMany({ select: { slug: true } }),
      prisma.advertiserType.findMany({ select: { slug: true } }),
      prisma.interest.findMany({ select: { slug: true } }),
    ]);

  const catalogVerticalSlugs = new Set(verticals.map((v) => v.slug));
  const catalogTypeSlugs = new Set(advertiserTypes.map((t) => t.slug));
  const catalogInterestSlugs = new Set(customerInterests.map((i) => i.slug));

  const orphanVerticals = dbVerticalSlugList
    .map((v) => v.slug)
    .filter((s) => !catalogVerticalSlugs.has(s));
  const orphanTypes = dbTypeSlugList
    .map((t) => t.slug)
    .filter((s) => !catalogTypeSlugs.has(s));
  const orphanInterests = dbInterestSlugList
    .map((i) => i.slug)
    .filter((s) => !catalogInterestSlugs.has(s));

  if (orphanVerticals.length || orphanTypes.length || orphanInterests.length) {
    const parts: string[] = [];
    if (orphanVerticals.length) {
      parts.push(
        `Verticals in DB but missing from @tagly/models catalog:\n  • ${orphanVerticals.join(
          ", ",
        )}`,
      );
    }
    if (orphanTypes.length) {
      parts.push(
        `Advertiser types in DB but missing from @tagly/models catalog:\n  • ${orphanTypes.join(
          ", ",
        )}`,
      );
    }
    if (orphanInterests.length) {
      parts.push(
        `Interests in DB but missing from @tagly/models catalog:\n  • ${orphanInterests.join(
          ", ",
        )}`,
      );
    }
    throw new Error(
      "DB rows without a matching catalog entry — add them to " +
        "tagly-shared/models/src/catalogs/ or write a migration to remove them:\n\n" +
        parts.join("\n\n"),
    );
  }

  console.log("DB ↔ catalog alignment OK.");
}

// Only run if executed directly
const isDirectExecution =
  process.argv[1]?.includes("verticals.ts") ||
  process.argv[1]?.includes("verticals.js");
if (isDirectExecution) {
  seedVerticals()
    .then(() => {
      console.log("Verticals seed completed!");
    })
    .catch((e) => {
      console.error("Verticals seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
