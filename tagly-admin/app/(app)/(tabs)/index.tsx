import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import {
  useTheme,
  Loading,
  TopMenu,
  useNavBottomPadding,
  callAuthed,
  useCatalogLocalizer,
} from "@tagly/client";
import {
  adminGetStatistics,
  adminGetStripeBalance,
} from "@tagly/sdk/v2/adminApp";
import type {
  AdminGetStatisticsResponse,
  AdminGetStripeBalanceResponse,
} from "@tagly/models/v2/adminApp";
import { useLogoutAction } from "@/hooks/useLogoutAction";
import {
  StatSection,
  StatTile,
  StatRows,
  TopList,
  LineChart,
} from "@/components/statistics/StatKit";
import {
  formatUsd,
  formatInt,
  formatPercent,
  formatSignedPercent,
  formatDateTime,
} from "@/utils/format";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
/** "2026-07" → "Jul". */
function monthShort(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return MONTHS[m - 1] ?? ym;
}

/** Uppercase overline separating the dashboard's section groups. */
function GroupLabel({ label }: { label: string }) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <Text
      style={[
        text.micro,
        {
          color: color.text.tertiary,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: spacing["2xl"],
        },
      ]}
    >
      {label}
    </Text>
  );
}

/**
 * Home / Dashboard tab — the platform statistics from `GET /v2/admin/statistics`
 * plus the live Stripe balance from `GET /v2/admin/balance/stripe` (the block
 * origin/main's dashboard led with). Sections are collapsible `StatSection`s
 * grouped under four overlines — Money / Growth / Marketplace / Engagement —
 * with color-coded chips (green = money, blue = people, butter = activity).
 * Each open section shows two hero tiles over one dense `StatRows` card, so
 * the screen scans as an index instead of a wall of half-empty tiles. Stripe
 * balance + Revenue open by default. Pull to refresh re-fetches both calls;
 * re-tapping the Home tab scrolls back to top (`useScrollToTop`). Log out bumps
 * `jwtVersion` server-side then clears the local session.
 */
export default function HomeScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const bottomPadding = useNavBottomPadding();
  const router = useRouter();
  const { verticalName, typeName } = useCatalogLocalizer();
  const logoutAction = useLogoutAction();

  const scrollRef = useRef<ScrollView>(null);
  // Re-tapping the active tab scrolls this screen to top (BottomNavigation emits
  // the tabPress this hook listens for).
  useScrollToTop(scrollRef);

  const [stats, setStats] = useState<AdminGetStatisticsResponse | null>(null);
  const [balance, setBalance] = useState<AdminGetStripeBalanceResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    // The Stripe balance is a separate live call (it hits the Stripe API); a
    // failure there must not blank the whole dashboard, so both are best-effort
    // and independent.
    const [statsRes, balanceRes] = await Promise.all([
      callAuthed(router, (jwt) => adminGetStatistics({ jwt }), {
        suppressAlerts: true,
      }),
      callAuthed(router, (jwt) => adminGetStripeBalance({ jwt }), {
        suppressAlerts: true,
      }),
    ]);
    if (statsRes.ok && statsRes.data) setStats(statsRes.data);
    if (balanceRes.ok && balanceRes.data) setBalance(balanceRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchAll();
  }, [fetchAll]);

  if (loading && !stats) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title="Dashboard" rightAction={logoutAction} />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Loading />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Dashboard" rightAction={logoutAction} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.screenPadding,
          paddingHorizontal: layout.screenPadding,
          paddingBottom: bottomPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // Default spinner tints are near-invisible on the cream background.
            tintColor={color.ink}
            colors={[color.ink]}
            progressBackgroundColor={color.surface}
          />
        }
      >
        {stats ? (
          <Text style={[text.micro, { color: color.text.tertiary }]}>
            Updated {formatDateTime(stats.generatedAt)} · pull to refresh
          </Text>
        ) : null}

        {!stats && !balance ? (
          <Text style={[text.body, { color: color.danger, marginTop: spacing.xl }]}>
            Couldn't load statistics. Pull to retry.
          </Text>
        ) : null}

        {/* ===================== Money ===================== */}
        {balance || stats ? <GroupLabel label="Money" /> : null}

        {balance ? (
          <StatSection
            title="Stripe balance"
            icon="wallet-outline"
            tint="money"
            summary={formatUsd(balance.stripeBalanceCents)}
            defaultOpen
          >
            <StatTile
              icon="logo-usd"
              chip="money"
              label="Total"
              value={formatUsd(balance.stripeBalanceCents)}
              tone="money"
              hint="Full USD balance on the Stripe platform account"
            />
            <StatTile
              icon="sparkles-outline"
              chip="money"
              label="Unassigned"
              value={formatUsd(balance.unassignedCents)}
              tone="money"
              hint="Free for subsidies and promos. Total minus assigned and locked"
            />
            <StatRows
              rows={[
                { icon: "briefcase-outline", label: "Advertisers", value: formatUsd(balance.assignedToAdvertisersCents), hint: "Available + locked credit balances" },
                { icon: "people-outline", label: "Customers", value: formatUsd(balance.assignedToCustomersCents), hint: "Available + locked reward balances" },
                { icon: "lock-closed-outline", label: "Locked", value: formatUsd(balance.lockedForSubsidizedSharesCents), hint: "Between subsidized share creation and payment" },
              ]}
            />
          </StatSection>
        ) : null}

        {stats ? (
          <>
            <StatSection
              title="Revenue"
              icon="cash-outline"
              tint="money"
              summary={formatUsd(stats.revenue.lifetimeRevenueCents)}
              defaultOpen
            >
              <StatTile
                icon="cash-outline"
                chip="money"
                label="Lifetime"
                value={formatUsd(stats.revenue.lifetimeRevenueCents)}
                tone="money"
                hint="All share payments, credit purchases, and promo credits"
              />
              <StatTile
                icon="trending-up-outline"
                chip="money"
                label="This month"
                value={formatUsd(stats.revenue.thisMonthRevenueCents)}
                tone="money"
                hint={`MoM growth ${formatSignedPercent(stats.revenue.monthOverMonthGrowthPercent)}`}
              />
              <StatRows
                rows={[
                  { icon: "calendar-outline", label: "Last month", value: formatUsd(stats.revenue.lastMonthRevenueCents), tone: "money" },
                  { icon: "stats-chart-outline", label: "MoM growth", value: formatSignedPercent(stats.revenue.monthOverMonthGrowthPercent) },
                ]}
              />
            </StatSection>

            <StatSection
              title="Financials"
              icon="card-outline"
              tint="money"
              summary={formatUsd(stats.financials.totalCreditPurchasesCents)}
            >
              <StatTile
                icon="card-outline"
                chip="money"
                label="Credit purchases"
                value={formatUsd(stats.financials.totalCreditPurchasesCents)}
                tone="money"
                hint="Lifetime advertiser credit purchases"
              />
              <StatTile
                icon="wallet-outline"
                chip="money"
                label="Unspent budget"
                value={formatUsd(stats.financials.totalAdvertiserUnspentBudgetCents)}
                hint="Available + locked budgets across all advertisers"
              />
              <StatRows
                rows={[
                  { icon: "receipt-outline", label: "Purchases this month", value: formatUsd(stats.financials.creditPurchasesThisMonthCents), hint: `${formatInt(stats.financials.creditPurchasesThisMonth)} purchases`, tone: "money" },
                  { icon: "arrow-down-circle-outline", label: "Customer withdrawals", value: formatUsd(stats.financials.totalWithdrawalsCents), tone: "money" },
                ]}
              />
            </StatSection>

            {/* ===================== Growth ===================== */}
            <GroupLabel label="Growth" />

            <StatSection
              title="Users"
              icon="people-outline"
              tint="accent"
              summary={formatInt(stats.users.totalCustomers)}
              footer={
                <LineChart
                  title="Total customers, last 12 months"
                  formatValue={formatInt}
                  data={stats.users.monthlyTrend.map((m) => ({
                    label: monthShort(m.month),
                    value: m.customers,
                  }))}
                />
              }
            >
              <StatTile
                icon="people-outline"
                chip="accent"
                label="Customers"
                value={formatInt(stats.users.totalCustomers)}
                hint={`+${stats.users.newCustomersThisWeek} this week`}
              />
              <StatTile
                icon="briefcase-outline"
                chip="accent"
                label="Advertisers"
                value={formatInt(stats.users.totalAdvertisers)}
                hint={`+${stats.users.newAdvertisersThisWeek} this week`}
              />
              <StatRows
                rows={[
                  { icon: "logo-instagram", label: "With Instagram", value: formatInt(stats.users.customersWithInstagram) },
                  { icon: "hourglass-outline", label: "Pending customers", value: formatInt(stats.users.pendingCustomers), hint: "Started registration, not finished yet", tone: "muted" },
                  { icon: "person-add-outline", label: "New customers today", value: formatInt(stats.users.newCustomersToday), hint: `${stats.users.newCustomersThisMonth} this month` },
                  { icon: "add-circle-outline", label: "New advertisers today", value: formatInt(stats.users.newAdvertisersToday), hint: `${stats.users.newAdvertisersThisMonth} this month` },
                ]}
              />
            </StatSection>

            <StatSection
              title="Shares"
              icon="share-social-outline"
              tint="brand"
              summary={formatInt(stats.shares.totalShares)}
              footer={
                <LineChart
                  title="New shares per month, last 12 months"
                  formatValue={formatInt}
                  data={stats.shares.monthlyTrend.map((m) => ({
                    label: monthShort(m.month),
                    value: m.shares,
                  }))}
                />
              }
            >
              <StatTile
                icon="share-social-outline"
                chip="brand"
                label="Total shares"
                value={formatInt(stats.shares.totalShares)}
                hint={`${stats.shares.sharesToday} today · ${stats.shares.sharesThisWeek} this week`}
              />
              <StatTile
                icon="checkmark-circle-outline"
                chip="brand"
                label="Paid shares"
                value={formatInt(stats.shares.paidShares)}
              />
              <StatRows
                rows={[
                  { icon: "eye-outline", label: "Pending review", value: formatInt(stats.shares.sharesPendingReview), tone: "muted" },
                  { icon: "calendar-outline", label: "Created this month", value: formatInt(stats.shares.sharesCreatedThisMonth) },
                  { icon: "pricetag-outline", label: "Avg price", value: formatUsd(stats.shares.averageSharePriceCents), hint: "Charged to advertisers per share", tone: "money" },
                  { icon: "gift-outline", label: "Avg reward", value: formatUsd(stats.shares.averageShareRewardCents), hint: "Paid to customers per share", tone: "money" },
                  { icon: "trending-up-outline", label: "Avg profit / share", value: formatUsd(stats.shares.averagePlatformProfitPerShareCents), hint: "Platform revenue after referral payouts", tone: "money" },
                  { icon: "people-outline", label: "Customers who shared", value: formatInt(stats.shares.customersWhoShared) },
                  { icon: "pie-chart-outline", label: "% customers shared", value: formatPercent(stats.shares.percentageOfCustomersWhoShared) },
                  { icon: "repeat-outline", label: "% shared again", value: formatPercent(stats.shares.percentageOfSharersWhoSharedMultiple), hint: "Of customers who shared at least once" },
                ]}
              />
            </StatSection>

            {/* ===================== Marketplace ===================== */}
            <GroupLabel label="Marketplace" />

            <StatSection
              title="Businesses"
              icon="storefront-outline"
              tint="accent"
              summary={formatInt(stats.businesses.totalActiveLocals)}
            >
              <StatTile
                icon="storefront-outline"
                chip="accent"
                label="Active businesses"
                value={formatInt(stats.businesses.totalActiveLocals)}
                hint="Status ACTIVE, visible to customers on the map"
              />
              <StatTile
                icon="business-outline"
                chip="accent"
                label="Total businesses"
                value={formatInt(stats.businesses.totalLocals)}
              />
              <StatRows
                rows={[
                  { icon: "card-outline", label: "Non-subsidized", value: formatInt(stats.businesses.totalNonSubsidizedLocals), hint: "Connected advertiser, no open subsidization period" },
                  {
                    icon: "git-branch-outline",
                    label: "Avg per advertiser",
                    value:
                      stats.businesses.averageSubaccountsPerAdvertiser != null
                        ? stats.businesses.averageSubaccountsPerAdvertiser.toFixed(1)
                        : "—",
                  },
                ]}
              />
              <TopList
                title="Top verticals"
                rows={stats.businesses.topVerticals.map((v) => ({
                  label: verticalName(v.slug),
                  value: formatInt(v.count),
                }))}
              />
              <TopList
                title="Top types"
                rows={stats.businesses.topTypes.map((t) => ({
                  label: typeName(t.slug),
                  value: formatInt(t.count),
                }))}
              />
            </StatSection>

            <StatSection
              title="Geographics"
              icon="map-outline"
              tint="brand"
              summary={stats.geographic.topBusinessLocations[0]?.city}
            >
              <TopList
                title="Top business locations"
                rows={stats.geographic.topBusinessLocations.map((l) => ({
                  label: `${l.city}, ${l.country}`,
                  value: formatInt(l.count),
                }))}
              />
              <TopList
                title="Top audience locations"
                rows={stats.geographic.topAudienceLocations.map((l) => ({
                  label: l.address,
                  value: formatInt(l.totalValue),
                }))}
              />
            </StatSection>

            {/* ===================== Engagement ===================== */}
            <GroupLabel label="Engagement" />

            <StatSection
              title="Instagram"
              icon="logo-instagram"
              tint="accent"
              summary={formatInt(stats.instagram.totalFollowerReach)}
            >
              <StatTile
                icon="megaphone-outline"
                chip="accent"
                label="Total follower reach"
                value={formatInt(stats.instagram.totalFollowerReach)}
                hint="Followers across all connected customer accounts"
              />
            </StatSection>

            <StatSection
              title="Notifications"
              icon="notifications-outline"
              tint="brand"
              summary={formatPercent(stats.notifications.customersWithPushEnabledPercent)}
            >
              <StatRows
                rows={[
                  { icon: "phone-portrait-outline", label: "Customers push-enabled", value: formatPercent(stats.notifications.customersWithPushEnabledPercent), hint: "At least one active push token" },
                  { icon: "phone-portrait-outline", label: "Advertisers push-enabled", value: formatPercent(stats.notifications.advertisersWithPushEnabledPercent), hint: "At least one active push token" },
                  { icon: "notifications-outline", label: "Customers promo opt-in", value: formatPercent(stats.notifications.customersPromoOptInPercent) },
                  { icon: "megaphone-outline", label: "Advertisers promo opt-in", value: formatPercent(stats.notifications.advertisersPromoOptInPercent) },
                ]}
              />
            </StatSection>
          </>
        ) : null}

      </ScrollView>
    </View>
  );
}
