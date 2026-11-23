import { TransactionKind } from "../../generated/prisma/client.js";
import { generateUid } from "../../utils/core/uids/generateUid.js";
import { generateReferralCode } from "../../utils/core/uids/generateReferralCode.js";
import prisma from "../../prisma/prisma.js";

/**
 * Seed Data Plan (single-account dev seed):
 *
 * | Email             | Entity | Locale | Subaccounts | Budget  |
 * | ----------------- | ------ | ------ | ----------- | ------- |
 * | matej@taglyapp.com   | null   | CZ     | 8 (Prague)  | $2,000  |
 *
 * One advertiser owns 8 Prague business pages; the remaining pages are
 * platform-subsidized (no advertiser) — see businessPages.ts. The advertiser has
 * no referrer. The available budget is reconciled DOWN in shares.ts to reflect the
 * locks/payments the seeded shares place, so it ends up ~$1,960 available + locked.
 *
 * Advertisers are passwordless (OTP / Google / Apple sign-in), so the seed
 * creates no credential — log in via the OTP flow (see TESTER_EMAIL/TESTER_OTP).
 */

const ADVERTISERS: {
  email: string;
  uid: string;
  initialDepositCents: number;
  entity: "INDIVIDUAL" | "ORGANIZATION" | null;
  locale: string;
  language: string;
  referredByCustomerEmail: string | null;
}[] = [
  {
    email: "matej@taglyapp.com",
    uid: generateUid("ADVERTISER"),
    initialDepositCents: 200_000, // $2,000
    entity: null,
    locale: "CZ",
    language: "cs",
    referredByCustomerEmail: null, // no referrer
  },
];

async function main() {
  for (const a of ADVERTISERS) {
    await prisma.$transaction(
      async (tx) => {
        // Look up referring customer's AccountReferral if specified
        let referrerAccountReferralId: number | null = null;
        if (a.referredByCustomerEmail) {
          const referringCustomer = await tx.customer.findUnique({
            where: { email: a.referredByCustomerEmail },
            select: { accountReferralId: true },
          });
          if (referringCustomer) {
            referrerAccountReferralId = referringCustomer.accountReferralId;
          } else {
            console.log(
              `Note: Referring customer ${a.referredByCustomerEmail} not found yet. Referral will not be set.`,
            );
          }
        }

        const sensitive = await tx.advertiserSensitiveData.create({
          data: {
            availableBudgetUsdCents: BigInt(a.initialDepositCents),
            lockedBudgetUsdCents: BigInt(0),
          },
        });

        // Create advertiser's own referral code (for referring others)
        const advertiserReferral = await tx.accountReferral.create({
          data: { code: generateReferralCode("ADVERTISER") },
        });

        const advertiser = await tx.advertiser.create({
          data: {
            accountReferralId: advertiserReferral.id,
            uid: a.uid,
            email: a.email,
            sensitiveDataId: sensitive.id,
            entity: a.entity,
            locale: a.locale,
            language: a.language,
            agreedToPrivacyPolicyAt: new Date(),
            agreedToTermsOfServiceAt: new Date(),
          },
        });

        // Create ReferralEvent linking customer's referral code to advertiser's referral code
        if (referrerAccountReferralId) {
          await tx.referralEvent.create({
            data: {
              referrerCodeId: referrerAccountReferralId,
              referredCodeId: advertiserReferral.id,
            },
          });
          console.log(
            `Created advertiser ${a.email} (${a.uid}) with $${(a.initialDepositCents / 100).toFixed(2)} budget`,
          );
          console.log(`  → Referred by customer: ${a.referredByCustomerEmail}`);
        } else {
          console.log(
            `Created advertiser ${a.email} (${a.uid}) with $${(a.initialDepositCents / 100).toFixed(2)} budget`,
          );
        }

        // Seed initial DEPOSIT so budget is derived from TransactionLedgerEvent
        await tx.transactionLedgerEvent.create({
          data: {
            kind: TransactionKind.CREDIT_PURCHASE,
            currency: "usd",
            advertiser: { connect: { id: advertiser.id } },
            deltaAdvertiserCents: BigInt(a.initialDepositCents),
            deltaPlatformCents: BigInt(0),
            grossSharePriceCents: null,
            externalRef: `seed-initial-deposit-${a.email}`,
            meta: {
              source: "SEED",
              note: `Initial advertiser deposit - $${(a.initialDepositCents / 100).toFixed(2)}`,
            },
          },
        });
      },
      { timeout: 1000_000 },
    );
  }
}

export { main as seedAdvertisers };

// Only run if executed directly
const isDirectExecution =
  process.argv[1]?.includes("advertisers.ts") ||
  process.argv[1]?.includes("advertisers.js");
if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error("Advertiser seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
