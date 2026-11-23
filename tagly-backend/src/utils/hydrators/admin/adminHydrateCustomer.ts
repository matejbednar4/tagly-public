import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import adminHydrateLedgerEvents from "./adminHydrateLedgerEvents.js";
import { adminGetNotificationPrefs } from "./adminGetNotificationPrefs.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { sharePaidSql } from "../../shares/shareAccess.js";
import { asBigInt } from "../../formatting/asBigInt.js";
import type {
  AdminCustomerInput,
  AdminCustomerWithdrawalInput,
} from "@tagly/models/v2/adminApp";
import type { SupportedLocale, SupportedLanguage } from "@tagly/models/shared";

export default async function adminHydrateCustomer({
  customerId,
}: {
  customerId: number;
}): Promise<AdminCustomerInput> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      uid: true,
      fullName: true,
      email: true,
      status: true,
      gender: true,
      locale: true,
      language: true,
      promoNotificationsEnabled: true,
      createdAt: true,
      updatedAt: true,
      agreedToTermsOfServiceAt: true,
      agreedToPrivacyPolicyAt: true,
      interests: { select: { slug: true }, orderBy: { sortOrder: "asc" } },
      pushTokens: { select: { platform: true, disabledAt: true } },
      oauthIdentities: {
        select: { provider: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      sensitiveData: {
        select: {
          balanceUsdCents: true,
          lockedBalanceUsdCents: true,
          multiplierBps: true,
          stripeConnectId: true,
          payoutsEnabledAt: true,
        },
      },
      instagram: {
        select: {
          instagramUid: true,
          username: true,
          name: true,
          pfpUrl: true,
          followerCount: true,
          accountType: true,
          createdAt: true,
          snapshots: {
            select: {
              followerCount: true,
              audienceLocationsSource: true,
              audienceLocationsTotalValue: true,
              audienceGenderAgeTotalValue: true,
              snapshotTakenAt: true,
              audienceLocations: {
                select: { address: true, value: true, source: true },
                orderBy: { value: "desc" },
              },
              audienceGenderAges: {
                select: { gender: true, age: true, value: true },
                orderBy: { value: "desc" },
              },
            },
            orderBy: { snapshotTakenAt: "desc" },
            take: 1,
          },
        },
      },
      accountReferral: {
        select: {
          id: true,
          code: true,
          status: true,
          referredEvent: {
            select: {
              referrerCode: {
                select: {
                  code: true,
                  customer: { select: { uid: true } },
                  advertiser: { select: { uid: true } },
                },
              },
              createdAt: true,
              adminReason: true,
              setByAdmin: { select: { uid: true, username: true } },
            },
          },
        },
      },
      stripeWithdrawals: {
        select: {
          uid: true,
          amountCents: true,
          currency: true,
          status: true,
          payoutStatus: true,
          purpose: true,
          instant: true,
          stripeTransferId: true,
          stripePayoutId: true,
          failureCode: true,
          failureMessage: true,
          ledgerEvents: { select: { id: true }, orderBy: { createdAt: "asc" } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    throw createCustomError(4043, "Customer not found", 404);
  }

  // Share aggregate stats (customer-facing: all their shares, unfiltered).
  const shareStatsRow = await db
    .selectFrom("app.shares as s")
    .select(() => [
      sql<number>`CAST(COUNT(*) AS INT)`.as("total_shares"),
      sql<number>`CAST(COUNT(*) FILTER (WHERE ${sharePaidSql("s")}) AS INT)`.as(
        "paid_shares",
      ),
      sql<number>`CAST(COUNT(DISTINCT s.local_id) AS INT)`.as("visited_places"),
    ])
    .where("s.customer_id", "=", customerId)
    .executeTakeFirst();

  const ledgerStatsRow = await db
    .selectFrom("app.transaction_ledger_events as tle")
    .select([
      sql<string>`COALESCE(SUM(tle.delta_customer_cents) FILTER (WHERE tle.kind = 'SHARE_PAYMENT'), 0)::text`.as(
        "total_rewards_cents",
      ),
      sql<string>`COALESCE(SUM(tle.delta_customer_cents) FILTER (WHERE tle.kind = 'REFERRAL_PAYOUT'), 0)::text`.as(
        "total_referral_payouts_cents",
      ),
    ])
    .where("tle.customer_id", "=", customerId)
    .executeTakeFirst();

  const paidShares = shareStatsRow?.paid_shares ?? 0;
  const totalRewardsCentsBig = asBigInt(
    ledgerStatsRow?.total_rewards_cents ?? "0",
  );

  // Ban reason lives on the persistent IG ban-list, only meaningful when
  // BANNED; matched by the row's `customerUid` audit pointer OR the linked IG,
  // so the reviewing admin still sees the reason after the customer
  // disconnected or switched Instagram (E059). Degrade to null on any miss.
  let banReason: string | null = null;
  if (customer.status === "BANNED") {
    const banned = await prisma.bannedInstagram
      .findFirst({
        where: {
          OR: [
            { customerUid: customer.uid },
            ...(customer.instagram?.instagramUid
              ? [{ instagramUid: customer.instagram.instagramUid }]
              : []),
          ],
        },
        select: { reason: true },
      })
      .catch(() => null);
    banReason = banned?.reason ?? null;
  }

  // Referral counts
  const referralId = customer.accountReferral.id;
  const [referredUsersCount, referredBusinessesCount] = await Promise.all([
    prisma.customer.count({
      where: { accountReferral: { referredEvent: { referrerCodeId: referralId } } },
    }),
    prisma.advertiser.count({
      where: { accountReferral: { referredEvent: { referrerCodeId: referralId } } },
    }),
  ]);

  const latestSnapshot = customer.instagram?.snapshots[0] ?? null;
  const instagramPayload = customer.instagram
    ? {
        instagramUid: customer.instagram.instagramUid,
        username: customer.instagram.username,
        name: customer.instagram.name,
        pfpUrl: customer.instagram.pfpUrl,
        followerCount: customer.instagram.followerCount,
        accountType: customer.instagram.accountType,
        connectedAt: customer.instagram.createdAt,
        latestSnapshot: latestSnapshot
          ? {
              followerCount: latestSnapshot.followerCount,
              audienceLocationsSource: latestSnapshot.audienceLocationsSource,
              audienceLocationsTotalValue:
                latestSnapshot.audienceLocationsTotalValue,
              audienceGenderAgeTotalValue:
                latestSnapshot.audienceGenderAgeTotalValue,
              snapshotTakenAt: latestSnapshot.snapshotTakenAt,
              // Only rows matching the snapshot's stamped source.
              audienceLocations: latestSnapshot.audienceLocations.filter(
                (loc) => loc.source === latestSnapshot.audienceLocationsSource,
              ),
              audienceGenderAges: latestSnapshot.audienceGenderAges,
            }
          : null,
      }
    : null;

  const referredByEvent = customer.accountReferral.referredEvent;
  const referralPayload = {
    code: customer.accountReferral.code,
    status: customer.accountReferral.status,
    referredUsersCount,
    referredBusinessesCount,
    referredBy: referredByEvent
      ? {
          code: referredByEvent.referrerCode.code,
          at: referredByEvent.createdAt,
          referrerUid:
            referredByEvent.referrerCode.customer?.uid ??
            referredByEvent.referrerCode.advertiser!.uid,
          referrerType: (referredByEvent.referrerCode.customer
            ? "customer"
            : "advertiser") as "customer" | "advertiser",
          setByAdmin: referredByEvent.setByAdmin
            ? {
                uid: referredByEvent.setByAdmin.uid,
                username: referredByEvent.setByAdmin.username,
                reason: referredByEvent.adminReason,
              }
            : null,
        }
      : null,
  };

  // Withdrawal ledger events
  const allWithdrawalLedgerEventIds = customer.stripeWithdrawals.flatMap((w) =>
    w.ledgerEvents.map((e) => e.id),
  );
  const hydratedWithdrawalLedgerEvents =
    allWithdrawalLedgerEventIds.length > 0
      ? await adminHydrateLedgerEvents({
          ledgerEventIds: allWithdrawalLedgerEventIds,
        })
      : [];
  const withdrawalLedgerEventById = new Map(
    allWithdrawalLedgerEventIds.map((id, i) => [
      id,
      hydratedWithdrawalLedgerEvents[i],
    ]),
  );

  const withdrawals: AdminCustomerWithdrawalInput[] =
    customer.stripeWithdrawals.map((w) => ({
      uid: w.uid,
      amountCents: w.amountCents,
      currency: w.currency,
      status: w.status,
      payoutStatus: w.payoutStatus,
      purpose: w.purpose,
      instant: w.instant,
      stripeTransferId: w.stripeTransferId ?? null,
      stripePayoutId: w.stripePayoutId ?? null,
      failureCode: w.failureCode ?? null,
      failureMessage: w.failureMessage ?? null,
      ledgerEvents: w.ledgerEvents.map(
        (e) => withdrawalLedgerEventById.get(e.id)!,
      ),
      createdAt: w.createdAt,
    }));

  // Per-event effective push/email state (§B.5).
  const notificationPrefs = await adminGetNotificationPrefs({
    target: "CUSTOMER",
    accountId: customerId,
  });

  const activeTokens = customer.pushTokens.filter((t) => t.disabledAt == null);
  const pushTokens = {
    activeCount: activeTokens.length,
    platforms: Array.from(
      new Set(
        activeTokens
          .map((t) => t.platform)
          .filter((p): p is string => p != null),
      ),
    ),
  };

  return {
    uid: customer.uid,
    fullName: customer.fullName,
    email: customer.email,
    status: customer.status,
    banReason,
    gender: customer.gender,
    // Writer-guaranteed supported values; read as-is (hydrators don't re-validate).
    locale: customer.locale as SupportedLocale,
    language: customer.language as SupportedLanguage,
    interests: customer.interests.map((i) => i.slug),
    promoNotificationsEnabled: customer.promoNotificationsEnabled,
    pushTokens,
    notificationPrefs,
    authIdentities: customer.oauthIdentities.map((i) => ({
      provider: i.provider,
      email: i.email,
      linkedAt: i.createdAt,
    })),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    agreedToTermsOfServiceAt: customer.agreedToTermsOfServiceAt,
    agreedToPrivacyPolicyAt: customer.agreedToPrivacyPolicyAt,
    sensitiveData: {
      balanceUsdCents: customer.sensitiveData.balanceUsdCents,
      lockedBalanceUsdCents: customer.sensitiveData.lockedBalanceUsdCents,
      multiplierBps: customer.sensitiveData.multiplierBps,
      stripeConnectId: customer.sensitiveData.stripeConnectId,
      payoutsEnabledAt: customer.sensitiveData.payoutsEnabledAt,
    },
    instagram: instagramPayload,
    shareStatistics: {
      totalShares: shareStatsRow?.total_shares ?? 0,
      paidShares,
      totalRewardsCents: totalRewardsCentsBig,
      averageRewardPerShareCents:
        paidShares > 0 ? totalRewardsCentsBig / BigInt(paidShares) : 0n,
      totalReferralPayoutsCents: asBigInt(
        ledgerStatsRow?.total_referral_payouts_cents ?? "0",
      ),
      visitedPlaces: shareStatsRow?.visited_places ?? 0,
    },
    referral: referralPayload,
    withdrawals,
  };
}
