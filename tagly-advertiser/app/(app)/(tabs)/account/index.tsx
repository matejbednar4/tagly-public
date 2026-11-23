import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import dayjs from "dayjs";
import {
  useTheme,
  TopMenu,
  ZoomOnFocus,
  SectionHeader,
  RefreshButton,
  HorizontalSnapList,
  FeedbackSheet,
  callAuthed,
  useFormatBudget,
  useNavBottomPadding,
  pressFeedbackStyle,
  withAlpha,
} from "@tagly/client";
import type {
  AdvertiserStatistics,
  BusinessOwnerPreview,
} from "@tagly/models/v2/advertiserApp";
import { getStatistics, getBusinesses } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { VisibilityCard } from "@/components/billing/VisibilityCard";
import { BusinessPreviewCard } from "@/components/businesses/BusinessPreviewCard";

const BUSINESS_CARD_WIDTH = 220;

/**
 * Account tab — the identity/results dashboard (settings-style utilities, log
 * out, and Invite & earn live in the drawer, mirroring the customer app). Top
 * to bottom:
 *   1. Profile header — email + member-since (customer-style square avatar),
 *      with the "Provide feedback" tile in the right corner (opens the shared
 *      `FeedbackSheet`), mirroring the customer account.
 *   2. Business pages — the advertiser's pages as a strip, + "add".
 *   3. Statistics — lifetime totals over admin-approved shares (incl. credits
 *      purchased), with the page-wide refresh. Customer-account style: a
 *      featured total-reach card + a 2-col grid of icon-row cards. Money stats
 *      display in ONE currency (CZK for CZ locale, USD otherwise) — no dual
 *      USD + ≈ CZK lines here.
 *
 * A recent-shares strip deliberately lives ONLY on the Home hub (its primary
 * "what's happening" surface) — repeating it here would just duplicate it.
 *
 * Profile rides on `AdvertiserMe` (context); statistics are fetched
 * screen-locally on mount (manual refresh thereafter), and the businesses strip
 * reloads on every focus so a page created/edited elsewhere shows on return.
 */
export default function AccountScreen() {
  const { t } = useTranslation("account");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const bottomPad = useNavBottomPadding();
  const { width } = useWindowDimensions();
  // The feedback tile sits in the profile header's right corner at ~22% of the
  // screen width (leaving the avatar + email the rest of the row) — same as
  // the customer account.
  const feedbackTileWidth = Math.round(width * 0.22);
  const { advertiser, refresh } = useAdvertiser();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [stats, setStats] = useState<AdvertiserStatistics | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOwnerPreview[] | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  // Pressing the active tab scrolls this screen back to the top (shared
  // BottomNavigation emits `tabPress`) — matches tagly-customer.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const loadStats = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const res = await callAuthed(router, (jwt) => getStatistics({ jwt }), {
        suppressAlerts: silent,
      });
      if (res.ok && res.data) setStats(res.data.statistics);
    },
    [router],
  );

  const loadBusinesses = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const res = await callAuthed(router, (jwt) => getBusinesses({ jwt }), {
        suppressAlerts: silent,
      });
      if (res.ok && res.data) setBusinesses(res.data.businesses);
    },
    [router],
  );

  useEffect(() => {
    void loadStats({ silent: true });
  }, [loadStats]);

  // Businesses reload on every focus (not just mount) so a page created on the
  // pushed create screen — or edited/removed elsewhere — shows the moment the
  // user returns here. `refresh()` (/me) doesn't cover this: the strip is its
  // own `getBusinesses` fetch, not part of the advertiser context.
  useFocusEffect(
    useCallback(() => {
      void loadBusinesses({ silent: true });
    }, [loadBusinesses]),
  );

  // Manual refresh — the RefreshButton owns the 60s cooldown; also re-pulls
  // /me so the profile + credits-purchased tile stay fresh.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadStats(), loadBusinesses()]);
    setRefreshing(false);
  }, [refresh, loadStats, loadBusinesses]);

  return (
    <ZoomOnFocus>
      <TopMenu title={t("title")} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: layout.screenPadding,
          paddingBottom: bottomPad,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Not-visible strip (tap → the visibility explainer). Renders nothing
            while the business is visible. */}
        <VisibilityCard style={{ marginHorizontal: layout.screenPadding }} />

        {/* Profile header — plain on the background; the square lifted avatar
            matches the customer account's Avatar treatment. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: layout.screenPadding,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.structure,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: color.accent,
              boxShadow: shadow.card,
            }}
          >
            <Ionicons name="business" size={28} color={color.on.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[text.bodyMedium, { color: color.text.primary }]}
              numberOfLines={1}
            >
              {advertiser?.email ?? ""}
            </Text>
            {advertiser?.createdAt ? (
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("memberSince", {
                  date: dayjs(advertiser.createdAt).format(
                    dayjs.locale() === "cs" ? "M/YYYY" : "MMM YYYY",
                  ),
                })}
              </Text>
            ) : null}
          </View>
          {/* Feedback / feature request — a labeled tile (~22% width) in the
              otherwise empty corner; opens the shared feedback sheet. */}
          <Pressable
            onPress={() => setFeedbackOpen(true)}
            accessibilityRole="button"
            style={({ pressed }: { pressed: boolean }) => ({
              width: feedbackTileWidth,
              alignItems: "center" as const,
              gap: spacing.xs,
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              boxShadow: shadow.card,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.xs,
              ...pressFeedbackStyle({ pressed }),
            })}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={color.text.secondary}
            />
            <Text
              style={[
                text.caption,
                { color: color.text.secondary, textAlign: "center" },
              ]}
              numberOfLines={2}
            >
              {t("provideFeedback")}
            </Text>
          </Pressable>
        </View>

        {/* Business pages */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ paddingHorizontal: layout.screenPadding }}>
            <SectionHeader title={t("businessesTitle")} />
          </View>
          {businesses === null ? (
            <View style={{ paddingVertical: spacing.lg }}>
              <ActivityIndicator color={color.text.tertiary} />
            </View>
          ) : (
            <HorizontalSnapList
              data={[...businesses, null]}
              cardWidth={BUSINESS_CARD_WIDTH}
              keyExtractor={(b) => (b ? b.uid : "add")}
              renderItem={(b) =>
                b ? (
                  <BusinessPreviewCard
                    business={b}
                    width={BUSINESS_CARD_WIDTH}
                    onPress={() => router.push(`/businesses/${b.uid}`)}
                  />
                ) : (
                  <AddBusinessTile
                    width={BUSINESS_CARD_WIDTH}
                    label={t("addBusiness")}
                    onPress={() => router.push("/businesses/create")}
                  />
                )
              }
            />
          )}
        </View>

        {/* Statistics — customer-account style: featured card + icon grid. */}
        <View
          style={{ paddingHorizontal: layout.screenPadding, gap: spacing.sm }}
        >
          <SectionHeader
            title={t("statsTitle")}
            right={<RefreshButton loading={refreshing} onPress={refreshAll} />}
          />
          {stats ? (
            <StatsDisplay
              stats={stats}
              creditsPurchasedCents={
                advertiser?.budgets.totalCreditPurchasesCents ?? 0
              }
            />
          ) : (
            <View style={{ paddingVertical: spacing.xl }}>
              <ActivityIndicator color={color.text.tertiary} />
            </View>
          )}
        </View>
      </ScrollView>

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </ZoomOnFocus>
  );
}

/** Dashed "add a business page" tile — the sanctioned empty/add-state border
 *  (see the design rules), sized to match the business cards. */
function AddBusinessTile({
  width,
  label,
  onPress,
}: {
  width: number;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        {
          width,
          aspectRatio: 16 / 9,
          borderRadius: radius.structure,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: color.border.strong,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xs,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name="add" size={24} color={color.text.secondary} />
      <Text style={[text.label, { color: color.text.secondary }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Statistics — total reach as the featured card, the rest in a 2-col grid
   of icon-row cards (mirrors the customer account's StatsDisplay). Money stats
   display in ONE currency: `formatBudget(cents)` picks CZK for CZ locale and
   USD otherwise — no dual USD + ≈ CZK lines. ────────────────────────────────── */

type StatItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Optional secondary line under the value (e.g. a ≈ CZK conversion). */
  subValue?: string;
  /** Money stats get the green icon chip; counts get the soft blue one. The
   *  value text stays primary ink either way — advertiser money is spend, not
   *  earnings, so it never renders green (green = money coming IN). */
  money: boolean;
  /** When set, the stat is pressable and navigates here. */
  route?: string;
};

/** The tinted icon circle — green for money stats, soft blue for counts
 *  (identical treatment to the customer account's StatIconChip). */
function StatIconChip({
  icon,
  money,
  size = 36,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  money: boolean;
  size?: number;
}) {
  const { theme } = useTheme();
  const { color, radius } = theme;
  const tone = money ? color.success : color.on.accent;
  const chip = money
    ? withAlpha(color.success, 0.14)
    : withAlpha(color.accent, 0.55);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: chip,
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tone} />
    </View>
  );
}

function StatsDisplay({
  stats,
  creditsPurchasedCents,
}: {
  stats: AdvertiserStatistics;
  creditsPurchasedCents: number;
}) {
  const { t } = useTranslation("account");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout, shadow } = theme;
  const formatBudget = useFormatBudget();

  const rest: StatItem[] = [
    {
      key: "shares",
      icon: "camera-outline",
      label: t("stats.shares"),
      value: stats.totalShares.toLocaleString(),
      money: false,
      route: "/shares",
    },
    {
      key: "spend",
      icon: "cash-outline",
      label: t("stats.spend"),
      value: formatBudget(stats.totalSpendCents),
      money: true,
      route: "/transactions",
    },
    {
      key: "avgPrice",
      icon: "pricetag-outline",
      label: t("stats.avgPrice"),
      value: formatBudget(stats.averagePricePerShareCents),
      money: true,
    },
    {
      key: "creditsPurchased",
      icon: "wallet-outline",
      label: t("stats.creditsPurchased"),
      value: formatBudget(creditsPurchasedCents),
      money: true,
    },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      {/* Featured — total reach, the headline marketing result. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
        }}
      >
        <StatIconChip icon="people-outline" money={false} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {t("stats.reach")}
          </Text>
          <Text
            style={[text.amount, { color: color.text.primary }]}
            numberOfLines={1}
          >
            {stats.totalReach.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* The rest — 2-col grid; each card is a row: icon · (value over label). */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {rest.map((it) => {
          const base = {
            flexGrow: 1,
            flexBasis: "45%" as const,
            flexDirection: "row" as const,
            alignItems: "center" as const,
            gap: spacing.sm,
            backgroundColor: color.surface,
            borderRadius: radius.structure,
            padding: layout.cardPaddingCompact,
            boxShadow: shadow.card,
          };
          const body = (
            <>
              <StatIconChip icon={it.icon} money={it.money} size={36} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[text.bodyMedium, { color: color.text.primary }]}
                  numberOfLines={1}
                >
                  {it.value}
                </Text>
                <Text
                  style={[text.caption, { color: color.text.secondary }]}
                  numberOfLines={1}
                >
                  {it.label}
                </Text>
              </View>
              {it.route ? (
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={color.text.tertiary}
                />
              ) : null}
            </>
          );
          return it.route ? (
            <Pressable
              key={it.key}
              onPress={() => router.push(it.route as never)}
              style={({ pressed }: { pressed: boolean }) => ({
                ...base,
                ...pressFeedbackStyle({ pressed }),
              })}
            >
              {body}
            </Pressable>
          ) : (
            <View key={it.key} style={base}>
              {body}
            </View>
          );
        })}
      </View>
    </View>
  );
}
