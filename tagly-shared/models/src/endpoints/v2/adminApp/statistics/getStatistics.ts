import { z } from "zod";

// ========== Revenue ==========
const RevenueStatsSchema = z.object({
  lifetimeRevenueCents: z.number(),
  thisMonthRevenueCents: z.number(),
  lastMonthRevenueCents: z.number(),
  monthOverMonthGrowthPercent: z.number().nullable(),
  monthlyTrend: z.array(
    z.object({ month: z.string(), revenueCents: z.number() }),
  ),
});

// ========== Users ==========
const UserStatsSchema = z.object({
  totalCustomers: z.number(),
  pendingCustomers: z.number(),
  customersWithInstagram: z.number(),
  totalAdvertisers: z.number(),
  newCustomersThisWeek: z.number(),
  newCustomersThisMonth: z.number(),
  newCustomersToday: z.number(),
  newAdvertisersThisWeek: z.number(),
  newAdvertisersThisMonth: z.number(),
  newAdvertisersToday: z.number(),
  monthlyTrend: z.array(
    z.object({
      month: z.string(),
      customers: z.number(),
      advertisers: z.number(),
    }),
  ),
});

// ========== Businesses ==========
const BusinessStatsSchema = z.object({
  totalActiveLocals: z.number(),
  totalLocals: z.number(),
  totalNonSubsidizedLocals: z.number(),
  averageSubaccountsPerAdvertiser: z.number().nullable(),
  // Slug only — the client localizes via `@tagly/models` catalogs.
  topVerticals: z.array(z.object({ slug: z.string(), count: z.number() })),
  topTypes: z.array(z.object({ slug: z.string(), count: z.number() })),
});

// ========== Shares ==========
// v2: all counts/metrics exclude REJECTED shares (controller-side).
const ShareStatsSchema = z.object({
  totalShares: z.number(),
  paidShares: z.number(),
  averageShareRewardCents: z.number().nullable(),
  averageSharePriceCents: z.number().nullable(),
  averagePlatformProfitPerShareCents: z.number().nullable(),
  sharesCreatedThisMonth: z.number(),
  sharesToday: z.number(),
  sharesThisWeek: z.number(),
  sharesPendingReview: z.number(),
  customersWhoShared: z.number(),
  percentageOfCustomersWhoShared: z.number().nullable(),
  percentageOfSharersWhoSharedMultiple: z.number().nullable(),
  monthlyTrend: z.array(z.object({ month: z.string(), shares: z.number() })),
});

// ========== Financials ==========
const FinancialStatsSchema = z.object({
  totalCreditPurchasesCents: z.number(),
  totalWithdrawalsCents: z.number(),
  creditPurchasesThisMonth: z.number(),
  creditPurchasesThisMonthCents: z.number(),
  totalAdvertiserUnspentBudgetCents: z.number(),
});

// ========== Geographic ==========
const GeographicStatsSchema = z.object({
  topBusinessLocations: z.array(
    z.object({ city: z.string(), country: z.string(), count: z.number() }),
  ),
  topAudienceLocations: z.array(
    z.object({ address: z.string(), totalValue: z.number() }),
  ),
});

// ========== Instagram ==========
const InstagramStatsSchema = z.object({
  totalFollowerReach: z.number(),
  averageFollowersPerCustomer: z.number().nullable(),
  customersWithInstagram: z.number(),
});

// ========== Notifications (v2, §B.4) ==========
const NotificationStatsSchema = z.object({
  /** Share of customers with `promoNotificationsEnabled = true`. */
  customersPromoOptInPercent: z.number().nullable(),
  /** Share of advertisers with `promoNotificationsEnabled = true`. */
  advertisersPromoOptInPercent: z.number().nullable(),
  /** Share of customers with ≥1 active (non-disabled) push token. */
  customersWithPushEnabledPercent: z.number().nullable(),
  /** Share of advertisers with ≥1 active (non-disabled) push token. */
  advertisersWithPushEnabledPercent: z.number().nullable(),
});

export const AdminGetStatisticsResponseSchema = z.object({
  message: z.string(),
  generatedAt: z.string(),
  revenue: RevenueStatsSchema,
  users: UserStatsSchema,
  businesses: BusinessStatsSchema,
  shares: ShareStatsSchema,
  financials: FinancialStatsSchema,
  geographic: GeographicStatsSchema,
  instagram: InstagramStatsSchema,
  notifications: NotificationStatsSchema,
});
export type AdminGetStatisticsResponse = z.infer<
  typeof AdminGetStatisticsResponseSchema
>;
