import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { db } from "../../../../db/kysely.js";
import { sql } from "kysely";
import type { AdminGetStatisticsResponse } from "@tagly/models/v2/adminApp";
import {
  NOT_REJECTED_SHARE_WHERE,
  PAID_SHARE_WHERE,
  PENDING_REPORT_WHERE,
  shareNotRejectedSql,
} from "../../../../utils/shares/shareAccess.js";

/**
 * `GET /v2/admin/statistics` — the platform aggregate dashboard: revenue, users,
 * businesses, shares, financials, geographic, instagram, and (v2) notification
 * opt-in. All money is derived from the transaction ledger.
 *
 * Conventions:
 *   - Every `shares.*` count/metric EXCLUDES rejected-like shares
 *     (`NOT_REJECTED_SHARE_WHERE`: intake-REJECTED OR killed by a VALID report) — PENDING still counts as "created".
 *   - Adds the `notifications` block (promo opt-in % + push-enabled %).
 *   - `customersWithInstagram` counts via the IG relation (the flat
 *     `customer.instagramUid` column no longer exists in v2).
 *
 * SUPER only (enforced in the router).
 */
export const getStatistics: RequestHandler = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Rejected shares are excluded from every share metric (the canonical
  // platform-wide "created" gate — PENDING still counts).
  const notRejected = NOT_REJECTED_SHARE_WHERE;

  // ========== Revenue ==========
  const [lifetimeRevenueRaw, thisMonthRevenueRaw, lastMonthRevenueRaw] =
    await Promise.all([
      prisma.transactionLedgerEvent.aggregate({
        _sum: { deltaPlatformCents: true },
      }),
      prisma.transactionLedgerEvent.aggregate({
        where: { createdAt: { gte: startOfThisMonth } },
        _sum: { deltaPlatformCents: true },
      }),
      prisma.transactionLedgerEvent.aggregate({
        where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
        _sum: { deltaPlatformCents: true },
      }),
    ]);

  const thisMonthRev = Number(thisMonthRevenueRaw._sum.deltaPlatformCents || 0n);
  const lastMonthRev = Number(lastMonthRevenueRaw._sum.deltaPlatformCents || 0n);
  const MoMGrowth =
    lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : null;

  const { rows: monthlyTrendData } = await sql<{
    month: string;
    revenue_cents: bigint;
  }>`
    SELECT months.month,
      (SELECT COALESCE(SUM(delta_platform_cents), 0)::bigint
       FROM app.transaction_ledger_events
       WHERE created_at < (TO_DATE(months.month, 'YYYY-MM') + INTERVAL '1 month')) as revenue_cents
    FROM (SELECT TO_CHAR(DATE_TRUNC('month', d), 'YYYY-MM') as month
      FROM generate_series(DATE_TRUNC('month', NOW() - INTERVAL '11 months'), DATE_TRUNC('month', NOW()), INTERVAL '1 month') d) months
    ORDER BY months.month ASC
  `.execute(db);

  // ========== Users ==========
  const [
    customerCount,
    pendingCustomerCount,
    customersWithInstagramCount,
    advertiserCount,
    newCustomersWeek,
    newCustomersMonth,
    newCustomersToday,
    newAdvertisersWeek,
    newAdvertisersMonth,
    newAdvertisersToday,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.pendingCustomer.count(),
    prisma.customer.count({ where: { instagram: { isNot: null } } }),
    prisma.advertiser.count(),
    prisma.customer.count({ where: { createdAt: { gte: startOfThisWeek } } }),
    prisma.customer.count({ where: { createdAt: { gte: startOfThisMonth } } }),
    prisma.customer.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.advertiser.count({ where: { createdAt: { gte: startOfThisWeek } } }),
    prisma.advertiser.count({ where: { createdAt: { gte: startOfThisMonth } } }),
    prisma.advertiser.count({ where: { createdAt: { gte: startOfToday } } }),
  ]);

  const { rows: monthlyUserTrendData } = await sql<{
    month: string;
    customers: bigint;
    advertisers: bigint;
  }>`
    SELECT months.month,
      (SELECT COUNT(*)::bigint FROM app.customers WHERE created_at < (TO_DATE(months.month, 'YYYY-MM') + INTERVAL '1 month')) as customers,
      (SELECT COUNT(*)::bigint FROM app.advertisers WHERE created_at < (TO_DATE(months.month, 'YYYY-MM') + INTERVAL '1 month')) as advertisers
    FROM (SELECT TO_CHAR(DATE_TRUNC('month', d), 'YYYY-MM') as month
      FROM generate_series(DATE_TRUNC('month', NOW() - INTERVAL '11 months'), DATE_TRUNC('month', NOW()), INTERVAL '1 month') d) months
    ORDER BY months.month ASC
  `.execute(db);

  // ========== Businesses ==========
  const [activeLocalCount, totalLocalCount, nonSubsidizedLocalCount] =
    await Promise.all([
      prisma.localSubaccount.count({ where: { status: "ACTIVE" } }),
      prisma.localSubaccount.count(),
      prisma.localSubaccount.count({
        where: {
          advertiserId: { not: null },
          subsidizationPeriods: { none: { endedAt: null } },
        },
      }),
    ]);
  const averageSubaccountsPerAdvertiser =
    advertiserCount > 0 ? totalLocalCount / advertiserCount : null;

  // ========== Shares (exclude REJECTED) ==========
  const [
    totalSharesCount,
    paidSharesCount,
    sharesThisMonth,
    sharesToday,
    sharesThisWeek,
  ] = await Promise.all([
    prisma.share.count({ where: notRejected }),
    prisma.share.count({ where: { ...PAID_SHARE_WHERE, ...notRejected } }),
    prisma.share.count({
      where: { createdAt: { gte: startOfThisMonth }, ...notRejected },
    }),
    prisma.share.count({
      where: { createdAt: { gte: startOfToday }, ...notRejected },
    }),
    prisma.share.count({
      where: { createdAt: { gte: startOfThisWeek }, ...notRejected },
    }),
  ]);

  const [customersWhoSharedRow, customersWhoSharedMultipleRow] =
    await Promise.all([
      db
        .selectFrom(
          db
            .selectFrom("app.shares")
            .select("customer_id")
            .where(shareNotRejectedSql(""))
            .distinct()
            .as("t"),
        )
        .select(db.fn.countAll<number>().as("count"))
        .executeTakeFirst(),
      db
        .selectFrom(
          db
            .selectFrom("app.shares")
            .select("customer_id")
            .where(shareNotRejectedSql(""))
            .groupBy("customer_id")
            .having(db.fn.countAll(), ">", 1)
            .as("t"),
        )
        .select(db.fn.countAll<number>().as("count"))
        .executeTakeFirst(),
    ]);
  const customersWhoShared = Number(customersWhoSharedRow?.count ?? 0);
  const customersWhoSharedMultiple = Number(
    customersWhoSharedMultipleRow?.count ?? 0,
  );
  const percentageOfCustomersWhoShared =
    customerCount > 0
      ? Math.round((customersWhoShared / customerCount) * 1000) / 10
      : null;
  const percentageOfSharersWhoSharedMultiple =
    customersWhoShared > 0
      ? Math.round((customersWhoSharedMultiple / customersWhoShared) * 1000) / 10
      : null;

  const { rows: monthlySharesTrendData } = await sql<{
    month: string;
    shares: bigint;
  }>`
    SELECT months.month,
      (SELECT COUNT(*)::bigint FROM app.shares
       WHERE ${shareNotRejectedSql("")}
         AND created_at >= TO_DATE(months.month, 'YYYY-MM')
         AND created_at < (TO_DATE(months.month, 'YYYY-MM') + INTERVAL '1 month')) as shares
    FROM (SELECT TO_CHAR(DATE_TRUNC('month', d), 'YYYY-MM') as month
      FROM generate_series(DATE_TRUNC('month', NOW() - INTERVAL '11 months'), DATE_TRUNC('month', NOW()), INTERVAL '1 month') d) months
    ORDER BY months.month ASC
  `.execute(db);

  const customerShareRewardsRaw = await prisma.transactionLedgerEvent.aggregate({
    where: { kind: "SHARE_PAYMENT" },
    _sum: { deltaCustomerCents: true },
    _count: { _all: true },
  });
  const totalCustomerShareRewardsCents = Number(
    customerShareRewardsRaw._sum.deltaCustomerCents || 0n,
  );
  const averageCustomerRewardCents =
    customerShareRewardsRaw._count._all > 0
      ? totalCustomerShareRewardsCents / customerShareRewardsRaw._count._all
      : null;

  const advertiserSharePricesRaw = await prisma.transactionLedgerEvent.aggregate({
    where: { kind: "SHARE_PAYMENT" },
    _sum: { deltaAdvertiserCents: true, deltaAdvertiserLockedCents: true },
    _count: { _all: true },
  });
  const totalAdvertiserSpendCents =
    Math.abs(Number(advertiserSharePricesRaw._sum.deltaAdvertiserCents ?? 0n)) +
    Math.abs(
      Number(advertiserSharePricesRaw._sum.deltaAdvertiserLockedCents ?? 0n),
    );
  const averageSharePriceCents =
    advertiserSharePricesRaw._count._all > 0
      ? totalAdvertiserSpendCents / advertiserSharePricesRaw._count._all
      : null;

  const sharesPendingReviewCount = await prisma.shareReport.count({
    where: PENDING_REPORT_WHERE,
  });

  // ========== Financials ==========
  const [
    totalCreditPurchasesRaw,
    creditPurchasesThisMonthRaw,
    totalWithdrawalsLedgerRaw,
    advertiserBudgetsRaw,
    sharePaymentRevenueRaw,
    referralPayoutsRaw,
  ] = await Promise.all([
    prisma.transactionLedgerEvent.aggregate({
      where: { kind: "CREDIT_PURCHASE" },
      _sum: { deltaAdvertiserCents: true },
    }),
    prisma.transactionLedgerEvent.aggregate({
      where: { kind: "CREDIT_PURCHASE", createdAt: { gte: startOfThisMonth } },
      _sum: { deltaAdvertiserCents: true },
      _count: { _all: true },
    }),
    prisma.transactionLedgerEvent.aggregate({
      where: { kind: "WITHDRAWAL" },
      _sum: { deltaCustomerCents: true, deltaCustomerLockedCents: true },
    }),
    prisma.advertiserSensitiveData.aggregate({
      _sum: { availableBudgetUsdCents: true, lockedBudgetUsdCents: true },
    }),
    prisma.transactionLedgerEvent.aggregate({
      where: { kind: "SHARE_PAYMENT" },
      _sum: { deltaPlatformCents: true },
    }),
    prisma.transactionLedgerEvent.aggregate({
      where: { kind: "REFERRAL_PAYOUT" },
      _sum: { deltaPlatformCents: true },
    }),
  ]);

  const totalWithdrawalsCents =
    Math.abs(Number(totalWithdrawalsLedgerRaw._sum.deltaCustomerCents ?? 0)) +
    Math.abs(
      Number(totalWithdrawalsLedgerRaw._sum.deltaCustomerLockedCents ?? 0),
    );
  const totalAdvertiserUnspentBudgetCents =
    Number(advertiserBudgetsRaw._sum.availableBudgetUsdCents || 0n) +
    Number(advertiserBudgetsRaw._sum.lockedBudgetUsdCents || 0n);
  const sharePaymentRevenueCents = Number(
    sharePaymentRevenueRaw._sum.deltaPlatformCents || 0n,
  );
  const referralPayoutsCents = Math.abs(
    Number(referralPayoutsRaw._sum.deltaPlatformCents || 0n),
  );
  const averagePlatformProfitPerShareCents =
    paidSharesCount > 0
      ? (sharePaymentRevenueCents - referralPayoutsCents) / paidSharesCount
      : null;

  // ========== Instagram ==========
  const instagramStatsRaw = await prisma.customerInstagramAccount.aggregate({
    where: { customerId: { not: null } },
    _sum: { followerCount: true },
    _avg: { followerCount: true },
    _count: { _all: true },
  });

  // ========== Geographic ==========
  const [topBusinessLocations, topAudienceLocations, topVerticals, topTypes] =
    await Promise.all([
      db
        .selectFrom("app.local_subaccounts as ls")
        .innerJoin("app.addresses as a", "a.id", "ls.address_id")
        .select(["a.city", "a.country", sql<bigint>`COUNT(*)::bigint`.as("count")])
        .where("ls.status", "=", "ACTIVE")
        .groupBy(["a.city", "a.country"])
        .orderBy(sql`count`, "desc")
        .limit(10)
        .execute(),
      db
        .selectFrom("app.instagram_audience_location")
        .select(["address", sql<bigint>`SUM(value)::bigint`.as("total_value")])
        .where("address", "is not", null)
        .groupBy("address")
        .orderBy(sql`total_value`, "desc")
        .limit(10)
        .execute(),
      db
        .selectFrom("app.local_subaccounts as ls")
        .innerJoin("app.advertiser_types as at", "at.id", "ls.type_id")
        .innerJoin("app._AdvertiserTypeToVertical as atv", "atv.A", "at.id")
        .innerJoin("app.verticals as v", "v.id", "atv.B")
        .select(["v.slug", sql<bigint>`COUNT(*)::bigint`.as("count")])
        .where("ls.status", "=", "ACTIVE")
        .groupBy("v.slug")
        .orderBy(sql`count`, "desc")
        .limit(5)
        .execute(),
      db
        .selectFrom("app.local_subaccounts as ls")
        .innerJoin("app.advertiser_types as at", "at.id", "ls.type_id")
        .select(["at.slug", sql<bigint>`COUNT(*)::bigint`.as("count")])
        .where("ls.status", "=", "ACTIVE")
        .groupBy("at.slug")
        .orderBy(sql`count`, "desc")
        .limit(5)
        .execute(),
    ]);

  // ========== Notifications (v2) ==========
  const [
    customersPromoOptIn,
    advertisersPromoOptIn,
    customersWithPush,
    advertisersWithPush,
  ] = await Promise.all([
    prisma.customer.count({ where: { promoNotificationsEnabled: true } }),
    prisma.advertiser.count({ where: { promoNotificationsEnabled: true } }),
    prisma.customer.count({
      where: { pushTokens: { some: { disabledAt: null } } },
    }),
    prisma.advertiser.count({
      where: { pushTokens: { some: { disabledAt: null } } },
    }),
  ]);
  const pct = (num: number, denom: number) =>
    denom > 0 ? Math.round((num / denom) * 1000) / 10 : null;

  const response: AdminGetStatisticsResponse = {
    message: "Statistics fetched successfully",
    generatedAt: now.toISOString(),

    revenue: {
      lifetimeRevenueCents: Number(lifetimeRevenueRaw._sum.deltaPlatformCents || 0n),
      thisMonthRevenueCents: thisMonthRev,
      lastMonthRevenueCents: lastMonthRev,
      monthOverMonthGrowthPercent:
        MoMGrowth != null ? Math.round(MoMGrowth * 100) / 100 : null,
      monthlyTrend: monthlyTrendData.map((m) => ({
        month: m.month,
        revenueCents: Number(m.revenue_cents),
      })),
    },

    users: {
      totalCustomers: customerCount,
      pendingCustomers: pendingCustomerCount,
      customersWithInstagram: customersWithInstagramCount,
      totalAdvertisers: advertiserCount,
      newCustomersThisWeek: newCustomersWeek,
      newCustomersThisMonth: newCustomersMonth,
      newCustomersToday,
      newAdvertisersThisWeek: newAdvertisersWeek,
      newAdvertisersThisMonth: newAdvertisersMonth,
      newAdvertisersToday,
      monthlyTrend: monthlyUserTrendData.map((m) => ({
        month: m.month,
        customers: Number(m.customers),
        advertisers: Number(m.advertisers),
      })),
    },

    businesses: {
      totalActiveLocals: activeLocalCount,
      totalLocals: totalLocalCount,
      totalNonSubsidizedLocals: nonSubsidizedLocalCount,
      averageSubaccountsPerAdvertiser,
      topVerticals: topVerticals.map((v) => ({
        slug: v.slug,
        count: Number(v.count),
      })),
      topTypes: topTypes.map((t) => ({ slug: t.slug, count: Number(t.count) })),
    },

    shares: {
      totalShares: totalSharesCount,
      paidShares: paidSharesCount,
      averageShareRewardCents: averageCustomerRewardCents,
      averageSharePriceCents,
      averagePlatformProfitPerShareCents,
      sharesCreatedThisMonth: sharesThisMonth,
      sharesToday,
      sharesThisWeek,
      sharesPendingReview: sharesPendingReviewCount,
      customersWhoShared,
      percentageOfCustomersWhoShared,
      percentageOfSharersWhoSharedMultiple,
      monthlyTrend: monthlySharesTrendData.map((m) => ({
        month: m.month,
        shares: Number(m.shares),
      })),
    },

    financials: {
      totalCreditPurchasesCents: Number(
        totalCreditPurchasesRaw._sum.deltaAdvertiserCents || 0n,
      ),
      totalWithdrawalsCents,
      creditPurchasesThisMonth: creditPurchasesThisMonthRaw._count._all,
      creditPurchasesThisMonthCents: Number(
        creditPurchasesThisMonthRaw._sum.deltaAdvertiserCents || 0n,
      ),
      totalAdvertiserUnspentBudgetCents,
    },

    geographic: {
      topBusinessLocations: topBusinessLocations.map((l) => ({
        city: l.city,
        country: l.country,
        count: Number(l.count),
      })),
      topAudienceLocations: topAudienceLocations.map((l) => ({
        address: l.address,
        totalValue: Number(l.total_value),
      })),
    },

    instagram: {
      totalFollowerReach: instagramStatsRaw._sum.followerCount || 0,
      averageFollowersPerCustomer: instagramStatsRaw._avg.followerCount
        ? Math.round(instagramStatsRaw._avg.followerCount)
        : null,
      customersWithInstagram: instagramStatsRaw._count._all,
    },

    notifications: {
      customersPromoOptInPercent: pct(customersPromoOptIn, customerCount),
      advertisersPromoOptInPercent: pct(advertisersPromoOptIn, advertiserCount),
      customersWithPushEnabledPercent: pct(customersWithPush, customerCount),
      advertisersWithPushEnabledPercent: pct(advertisersWithPush, advertiserCount),
    },
  };

  res.status(200).json(response);
});
