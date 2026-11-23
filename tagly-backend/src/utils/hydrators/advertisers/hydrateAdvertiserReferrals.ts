import prisma from "../../../prisma/prisma.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { REFERRAL_RATES } from "../../referrals/referralRates.js";
import type { AdvertiserReferralsInput } from "@tagly/models/v2/advertiserApp";

/**
 * Referral state for `GET /v2/advertisers/me/referrals` — the advertiser's own
 * code + status, who referred them, how many businesses/users they've referred,
 * and their lifetime REFERRAL_PAYOUT budget credits. Twin of
 * `hydrateCustomerReferrals` (advertiser-side ledger column); the referred
 * counts + payout sum run concurrently.
 */
export async function hydrateAdvertiserReferrals(
  advertiserId: number
): Promise<AdvertiserReferralsInput> {
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      accountReferral: {
        select: {
          id: true,
          code: true,
          status: true,
          referredEvent: {
            select: {
              referrerCode: { select: { code: true } },
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!advertiser) {
    throw createCustomError(4044, "Advertiser not found", 404);
  }
  const { accountReferral } = advertiser;

  const [referredBusinessesCount, referredUsersCount, ledgerRow] =
    await Promise.all([
      prisma.advertiser.count({
        where: {
          accountReferral: {
            referredEvent: { referrerCodeId: accountReferral.id },
          },
        },
      }),
      prisma.customer.count({
        where: {
          accountReferral: {
            referredEvent: { referrerCodeId: accountReferral.id },
          },
        },
      }),
      db
        .selectFrom("app.transaction_ledger_events as tle")
        .select([
          sql<string>`
            COALESCE(
              SUM(tle.delta_advertiser_cents) FILTER (
                WHERE tle.kind = 'REFERRAL_PAYOUT'
              ), 0
            )::text
          `.as("referral_payouts_cents"),
        ])
        .where("tle.advertiser_id", "=", advertiserId)
        .executeTakeFirst(),
    ]);

  return {
    code: accountReferral.code,
    status: accountReferral.status,
    referredEvent: accountReferral.referredEvent,
    referredBusinessesCount,
    referredUsersCount,
    // COALESCE(..., 0)::text always yields a valid integer string.
    totalReferralPayoutsCents: BigInt(ledgerRow?.referral_payouts_cents ?? "0"),
    rates: REFERRAL_RATES,
  };
}
