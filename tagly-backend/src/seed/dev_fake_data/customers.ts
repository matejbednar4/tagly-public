/**
 * Customer seed (single-account dev seed)
 *
 * Prerequisites:
 * - Advertisers must exist (for the referral relationship)
 *
 * Creates:
 * - 1 customer (matt) with an Instagram account, referred by the advertiser
 * - Matt's standalone Instagram snapshot (Prague-weighted audience) so reward
 *   estimates are healthy for the Prague business pages
 */

import { Gender } from "../../generated/prisma/client.js";
import { generateUid } from "../../utils/core/uids/generateUid.js";
import { generateReferralCode } from "../../utils/core/uids/generateReferralCode.js";
import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const CUSTOMERS = [
  {
    email: "matej@taglyapp.com",
    fullName: "matt",
    gender: Gender.MALE,
    instagramUid: "26756776647256123",
    followerCount: 900,
    referredByAdvertiserEmail: "matej@taglyapp.com",
    locale: "CZ",
    language: "cs",
  },
] as const;

// Matt's standalone snapshot demographics — audience weighted to Prague + nearby
// CZ so the Prague business pages price with a strong geo multiplier (the PostGIS
// hex values are EWKB points reused from prior seed data).
export const MATT_SNAPSHOT = {
  audienceLocationsTotalValue: 550,
  audienceGenderAgeTotalValue: 825,
  audienceGenderAge: [
    { gender: "M" as const, age: "18-24", value: 250 },
    { gender: "M" as const, age: "25-34", value: 125 },
    { gender: "F" as const, age: "18-24", value: 188 },
    { gender: "U" as const, age: "18-24", value: 187 },
    { gender: "F" as const, age: "25-34", value: 75 },
  ],
  // Weights tuned so the v2 geo multiplier lands at ≈1.70x for Prague
  // businesses (Prague rows price ≈2.17x, Slaný/Kladno ≈1.0–1.1x), which with
  // reach ≈236 and the $25 estimate eCPM prices a Prague CREDITS restaurant
  // at ≈963¢ gross / ≈578¢ reward (≈120 Kč) — the target demo numbers. Tune
  // the geo by shifting weight between Prague and the two ~25–30km towns, not
  // by editing the GEO curve (that would re-price the whole algorithm).
  audienceLocation: [
    {
      address: "Prague, Prague",
      value: 320,
      location: "0101000020E61000003547534F96E42C402AF3A0EAA1074940",
    },
    {
      address: "Slaný, CZ",
      value: 120,
      location: "0101000020E6100000044FC69D772C2C400274A95B871D4940",
    },
    {
      address: "Kladno, CZ",
      value: 110,
      location: "0101000020E6100000358930348D342C40CB7564F6C3124940",
    },
  ],
};

export type CustomerMap = Map<
  string,
  {
    id: number;
    email: string;
    accountReferralId: number;
    sensitiveDataId: number;
    instagramAccountId: number;
    followerCount: number;
    referredByAdvertiserId: number | null;
  }
>;

export async function seedCustomers(
  tx: Prisma.TransactionClient,
): Promise<CustomerMap> {
  console.log("Creating 1 customer...");

  // Fetch the advertiser for the referral relationship
  const advertisers = await tx.advertiser.findMany({
    where: { email: { in: ["matej@taglyapp.com"] } },
    include: { accountReferral: true },
  });

  const customerMap: CustomerMap = new Map();

  for (const custConfig of CUSTOMERS) {
    // Create referral code
    const customerReferral = await tx.accountReferral.create({
      data: { code: generateReferralCode("CUSTOMER") },
    });

    // Create sensitive data
    const sensitiveData = await tx.customerSensitiveData.create({
      data: {
        balanceUsdCents: 0n,
        lockedBalanceUsdCents: 0n,
      },
    });

    // Create customer
    const customer = await tx.customer.create({
      data: {
        uid: generateUid("CUSTOMER"),
        email: custConfig.email,
        fullName: custConfig.fullName,
        gender: custConfig.gender,
        locale: custConfig.locale,
        language: custConfig.language,
        sensitiveDataId: sensitiveData.id,
        accountReferralId: customerReferral.id,
        agreedToTermsOfServiceAt: new Date(),
        agreedToPrivacyPolicyAt: new Date(),
      },
    });

    // Create Instagram account
    const instagramAccount = await tx.customerInstagramAccount.create({
      data: {
        customerId: customer.id,
        instagramUid: custConfig.instagramUid,
        username: custConfig.email.split("@")[0],
        name: custConfig.fullName,
        followerCount: custConfig.followerCount,
        accountType: "PERSONAL",
      },
    });

    // Find referrer advertiser
    let referredByAdvertiserId: number | null = null;
    if (custConfig.referredByAdvertiserEmail) {
      const referrerAdv = advertisers.find(
        (a) => a.email === custConfig.referredByAdvertiserEmail,
      );
      if (referrerAdv) {
        // Create referral event: advertiser referred this customer
        await tx.referralEvent.create({
          data: {
            referrerCodeId: referrerAdv.accountReferral.id,
            referredCodeId: customerReferral.id,
          },
        });
        referredByAdvertiserId = referrerAdv.id;
        console.log(
          `  → ${custConfig.email} referred by ADV ${referrerAdv.email}`,
        );
      }
    }

    customerMap.set(custConfig.email, {
      id: customer.id,
      email: custConfig.email,
      accountReferralId: customerReferral.id,
      sensitiveDataId: sensitiveData.id,
      instagramAccountId: instagramAccount.id,
      followerCount: custConfig.followerCount,
      referredByAdvertiserId,
    });

    console.log(`  → Created customer: ${custConfig.email} (${customer.uid})`);
  }

  // Create Matt's standalone snapshot (Prague-weighted audience)
  console.log("\nCreating Matt's standalone Instagram snapshot...");
  const matt = customerMap.get("matej@taglyapp.com")!;

  const mattStandaloneSnapshot = await tx.instagramSnapshot.create({
    data: {
      shareId: null, // Standalone, not tied to a share
      instagramId: matt.instagramAccountId,
      followerCount: matt.followerCount,
      audienceLocationsSource: "FOLLOWER_AUDIENCE",
      audienceLocationsTotalValue: MATT_SNAPSHOT.audienceLocationsTotalValue,
      audienceGenderAgeTotalValue: MATT_SNAPSHOT.audienceGenderAgeTotalValue,
      snapshotTakenAt: new Date(),
    },
  });

  // Create audience gender/age records
  for (const ga of MATT_SNAPSHOT.audienceGenderAge) {
    await tx.instagramAudienceGenderAge.create({
      data: {
        snapshotId: mattStandaloneSnapshot.id,
        gender: ga.gender,
        age: ga.age,
        value: ga.value,
      },
    });
  }

  // Create audience location records using raw SQL for PostGIS
  for (const loc of MATT_SNAPSHOT.audienceLocation) {
    await tx.$executeRaw`
      INSERT INTO "app"."instagram_audience_location"
        ("snapshot_id", "address", "value", "location", "source", "created_at", "updated_at")
      VALUES (
        ${mattStandaloneSnapshot.id},
        ${loc.address},
        ${loc.value},
        ${loc.location}::geography,
        'FOLLOWER_AUDIENCE'::"app"."AudienceLocationSource",
        NOW(), NOW()
      )
    `;
  }

  console.log(
    `  → Created standalone snapshot for Matt with ${MATT_SNAPSHOT.audienceGenderAge.length} gender/age + ${MATT_SNAPSHOT.audienceLocation.length} location records`,
  );

  return customerMap;
}

// Standalone execution
async function main() {
  console.log("Starting customer seed...\n");

  await prisma.$transaction(
    async (tx) => {
      await seedCustomers(tx);
      console.log("\nCustomer seed completed!");
    },
    { timeout: 600_000 },
  );
}

// Only run if executed directly
const isDirectExecution = process.argv[1]?.includes("customers.ts");
if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error("Customer seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
