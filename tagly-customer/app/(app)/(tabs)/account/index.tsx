import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  BottomSheet,
  callAuthed,
  CustomButton,
  FeedbackSheet,
  pressFeedbackStyle,
  RefreshButton,
  SectionHeader,
  SupportSheet,
  TopMenu,
  useFormatBudget,
  useNavBottomPadding,
  useTheme,
  withAlpha,
  ZoomOnFocus,
} from "@tagly/client";
import {
  createExpressDashboardLink,
  getStatistics,
} from "@tagly/sdk/v2/customerApp";
import type { CustomerStatistics } from "@tagly/models/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import {
  useInstagramConnection,
  useInstagramStatusLabel,
} from "@/contexts/instagram/InstagramConnectionContext";
import InstagramConnectionPrompt from "@/components/instagram/InstagramConnectionPrompt";
import LatestShares from "@/components/shares/LatestShares";
import LatestTransactions from "@/components/transactions/LatestTransactions";

/**
 * Account tab — the "me + my activity + my money" hub. Top to bottom:
 *  1. Profile — avatar + name + handle, plain on the background (no card).
 *  2. Instagram — connected identity / reconnect affordance (shared prompt).
 *  3. Money — available balance + a compact cash-out CTA on one row, and (once a
 *     Connect account exists) a Stripe Express dashboard link as a footer row.
 *     There is no "locked" figure: a customer's balance is only locked for the
 *     moment a withdrawal is in flight, so it is noise on a hub. The customer's
 *     money lives in the Tagly balance (shown here); the Connect account is a
 *     pass-through to the bank, so we don't display its balance — the dashboard
 *     link is the way to inspect it. The Stripe affordance is hidden until a
 *     Connect account exists (`stripeConnectId`).
 *  4. Your shares — recent strip (`/me/shares`) → "See all" → /shares list.
 *  5. Statistics — `/me/statistics` figures.
 *  6. Recent transactions → "See all" → /transactions.
 *
 * Every zone reads live data (`useCustomer`, `/me/statistics`, `/me/shares`,
 * IG via `InstagramConnectionContext`); cash-out pushes `/withdraw`. Settings +
 * Log out live in the drawer.
 *
 * Section headings use the shared `SectionHeader` (low-prominence, Discover
 * style) so they recede and the components do the talking.
 */
export default function AccountScreen() {
  const { t } = useTranslation("account");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const navBottomPadding = useNavBottomPadding();
  const { width } = useWindowDimensions();
  // The feedback tile sits in the profile header's right corner at ~22% of the
  // screen width (leaving the avatar + name/handle the rest of the row).
  const feedbackTileWidth = Math.round(width * 0.22);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const { customer } = useCustomer();
  const banned = customer?.status === "BANNED";
  const { instagramState } = useInstagramConnection();
  const igStatus = useInstagramStatusLabel();

  const ig = customer?.instagram;
  const balanceCents = customer?.sensitiveData.balanceUsdCents ?? 0;
  const payoutsEnabled = !!customer?.sensitiveData.payoutsEnabledAt;
  // A Connect account exists (from /me — no extra call) → we can open the Stripe
  // Express dashboard, where the customer sees their real Stripe balance, payout
  // history, and bank details, and can fix payout details.
  const hasConnectAccount = !!customer?.sensitiveData.stripeConnectId;

  // Open the Stripe Express dashboard (one-time login link). Only the tap costs a
  // Stripe call — nothing is fetched on screen load.
  const openStripeDashboard = async () => {
    if (dashboardLoading) return;
    setDashboardLoading(true);
    const res = await callAuthed(router, (jwt) =>
      createExpressDashboardLink({ jwt }),
    );
    if (res.ok && res.data) {
      await WebBrowser.openBrowserAsync(res.data.url);
    }
    setDashboardLoading(false);
  };

  // ── Statistics (own cached sub-resource). Loaded on mount (silent) and
  // re-fetchable via the section's refresh button (surfaces errors). ──────────
  const [stats, setStats] = useState<CustomerStatistics | null>(null);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const loadStats = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) setStatsRefreshing(true);
      const result = await callAuthed(router, (jwt) => getStatistics({ jwt }), {
        suppressAlerts: !!silent,
      });
      if (result.ok && result.data) setStats(result.data.statistics);
      if (!silent) setStatsRefreshing(false);
    },
    [router],
  );
  useEffect(() => {
    loadStats({ silent: true });
  }, [loadStats]);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <ZoomOnFocus>
      <TopMenu title={t("title")} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: color.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.screenPadding,
          paddingBottom: navBottomPadding,
          gap: spacing.xl,
        }}
      >
        {/* The ScrollView itself has no horizontal padding so the "Your shares"
            strip (zone 4) can bleed off both edges; every other zone insets
            itself with `marginHorizontal: layout.screenPadding`. */}

        {/* ── Banned banner — first thing a banned user sees. Same visual
            language as the advertiser's BannedBusinessNotice (soft dangerBg
            card, tappable → Contact support), plus the ban reason when recorded.
            The actual point-of-action blocks (create-share, cash-out) come from
            the central 1540 error mapping when those v2 endpoints land. ─────── */}
        {banned && (
          <View style={{ marginHorizontal: layout.screenPadding }}>
            <Pressable
              onPress={() => setSupportOpen(true)}
              accessibilityRole="button"
              style={({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => [
                {
                  backgroundColor: color.dangerBg,
                  borderRadius: radius.structure,
                  padding: layout.cardPadding,
                  gap: spacing.xs,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={color.on.dangerBg}
                />
                <Text style={[text.bodyMedium, { color: color.on.dangerBg }]}>
                  {t("bannedTitle")}
                </Text>
              </View>
              <Text style={[text.caption, { color: color.on.dangerBg }]}>
                {t("bannedBody")}
              </Text>
              {customer?.banReason ? (
                <Text style={[text.caption, { color: color.on.dangerBg }]}>
                  {t("bannedReasonLabel")}: {customer.banReason}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Text style={[text.label, { color: color.on.dangerBg }]}>
                  {t("bannedContactSupport")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={color.on.dangerBg}
                />
              </View>
            </Pressable>
          </View>
        )}

        {/* ── Zone 1: Profile — plain on the background, no card ────────────── */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            alignItems: "center",
            marginHorizontal: layout.screenPadding,
          }}
        >
          <Avatar pfpUrl={ig?.pfpUrl ?? null} />
          <View style={{ flex: 1 }}>
            <Text
              style={[text.title, { color: color.text.primary }]}
              numberOfLines={1}
            >
              {customer?.fullName ?? ""}
            </Text>
            {ig?.username ? (
              <Text
                style={[text.caption, { color: color.text.secondary }]}
                numberOfLines={1}
              >
                <Ionicons name="logo-instagram" /> @{ig.username}
              </Text>
            ) : null}
            {ig && instagramState === "CONNECTED" ? (
              <Text
                style={[text.caption, { color: color.text.tertiary }]}
                numberOfLines={1}
              >
                {ig.hasSnapshot
                  ? t("igFollowers", {
                      followers: ig.followerCount.toLocaleString(),
                    })
                  : t("igCalculating")}
              </Text>
            ) : null}
            {igStatus ? (
              <Text
                style={[
                  text.caption,
                  {
                    color: igStatus.danger ? color.danger : color.text.tertiary,
                  },
                ]}
                numberOfLines={1}
              >
                <Ionicons name="alert-circle" /> {igStatus.text}
              </Text>
            ) : null}
          </View>
          {/* Feedback / feature request — a labeled tile (~22% width) in the
              otherwise empty corner; opens the in-app feedback sheet. */}
          <Pressable
            onPress={() => setFeedbackOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              width: feedbackTileWidth,
              alignItems: "center",
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

        {/* ── Zone 2: Instagram connect/reconnect prompt — only when there's an
            action to take. When connected, the handle + follower count live in
            the profile header above (no card), so nothing renders here. ─────── */}
        {instagramState !== "CONNECTED" && (
          <View style={{ marginHorizontal: layout.screenPadding }}>
            <InstagramConnectionPrompt />
          </View>
        )}

        {/* ── Zone 3: Money — balance + cash-out card (see MoneyZone). ─────── */}
        <MoneyZone
          balanceCents={balanceCents}
          payoutsEnabled={payoutsEnabled}
          hasConnectAccount={hasConnectAccount}
          dashboardLoading={dashboardLoading}
          onCashOut={() => router.push("/withdraw")}
          onManage={openStripeDashboard}
        />

        {/* ── Zone 4: Your shares (recent strip → full list) ───────────────── */}
        <LatestShares />

        {/* ── Zone 5: Statistics ───────────────────────────────────────────── */}
        <View
          style={{ gap: spacing.sm, marginHorizontal: layout.screenPadding }}
        >
          <SectionHeader
            title={t("statsTitle")}
            right={
              <RefreshButton
                loading={statsRefreshing}
                onPress={() => loadStats()}
              />
            }
          />
          {stats === null ? (
            <View style={{ paddingVertical: spacing.xl }}>
              <ActivityIndicator color={color.text.tertiary} />
            </View>
          ) : (
            <StatsDisplay stats={stats} />
          )}
        </View>

        {/* ── Zone 6: Recent transactions (latest few → /transactions) ─────── */}
        <LatestTransactions />
      </ScrollView>

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />

      {/* Contact support — opened from the banned banner (ban appeal); the
          `context` tag lets the team triage the request. */}
      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="banned-account"
      />
    </ZoomOnFocus>
  );
}

/* ── Avatar — IG profile picture or a fallback tile ──────────────────────────── */
function Avatar({ pfpUrl }: { pfpUrl: string | null }) {
  const { theme } = useTheme();
  const { color, radius, shadow } = theme;
  const size = 64;
  if (pfpUrl) {
    // The shadow lives on a wrapping View — `boxShadow` is a ViewStyle prop, not
    // valid on RN's ImageStyle.
    return (
      <View style={{ borderRadius: radius.structure, boxShadow: shadow.card }}>
        <Image
          source={{ uri: pfpUrl }}
          style={{ width: size, height: size, borderRadius: radius.structure }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.structure,
        backgroundColor: color.accent,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: shadow.card,
      }}
    >
      <Ionicons name="person" size={30} color={color.on.accent} />
    </View>
  );
}

/**
 * The available-balance block — label + big green amount + ≈ CZK secondary line.
 *
 * The composed text styles carry line-height leading (label 1.2×, caption 1.4×,
 * amountLg 44/40) that makes the stacked label→USD→CZK gaps look uneven. We hug
 * each line to its glyphs (lineHeight = fontSize) so the flex `gap` alone sets the
 * spacing and the three read as one evenly-spaced unit.
 *
 * `amountSize` tunes the balance figure (default 40); the split money card uses a
 * slightly smaller one so it fits beside the inline Cash out button.
 */
function BalanceBlock({
  balanceCents,
  amountSize = 40,
  style,
}: {
  balanceCents: number;
  amountSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation("account");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const formatBudget = useFormatBudget();
  const secondary = formatBudget(balanceCents, { asCzkSecondaryLine: true });

  return (
    <View style={[{ alignItems: "flex-start", gap: spacing.xs }, style]}>
      <Text
        style={[text.label, { color: color.text.secondary, lineHeight: 14 }]}
      >
        {t("available")}
      </Text>
      <Text
        style={[
          text.amountLg,
          {
            color: color.success,
            fontSize: amountSize,
            lineHeight: amountSize,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatBudget(balanceCents, { forcedCurrency: "USD" })}
      </Text>
      {secondary ? (
        <Text
          style={[text.caption, { color: color.text.tertiary, lineHeight: 13 }]}
        >
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Money zone — the balance figure and a compact Cash out share the top row; the
 * Stripe Express dashboard link is a footer row inside the same card, hidden
 * until a Connect account exists (`hasConnectAccount`).
 */
function MoneyZone({
  balanceCents,
  payoutsEnabled,
  hasConnectAccount,
  dashboardLoading,
  onCashOut,
  onManage,
}: {
  balanceCents: number;
  payoutsEnabled: boolean;
  hasConnectAccount: boolean;
  dashboardLoading: boolean;
  onCashOut: () => void;
  onManage: () => void;
}) {
  const { t } = useTranslation("account");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const cashOutLabel = payoutsEnabled ? t("cashOut") : t("setUpPayouts");

  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPadding,
        boxShadow: shadow.card,
        marginHorizontal: layout.screenPadding,
      }}
    >
      {/* Balance left + inline Cash out right. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingBottom: hasConnectAccount ? spacing.lg : 0,
        }}
      >
        <BalanceBlock
          balanceCents={balanceCents}
          amountSize={36}
          style={{ flex: 1 }}
        />
        <CustomButton
          type="primary"
          label={cashOutLabel}
          icon="cash-outline"
          onPress={onCashOut}
        />
      </View>

      {/* Stripe Express dashboard — real Stripe balance, payout history, bank
          details — as a footer row. */}
      {hasConnectAccount ? (
        <>
          <View style={{ height: 1, backgroundColor: color.border.divider }} />
          <Pressable
            onPress={onManage}
            disabled={dashboardLoading}
            accessibilityRole="button"
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingTop: spacing.md,
                minHeight: 44,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            {dashboardLoading ? (
              <ActivityIndicator size="small" color={color.text.secondary} />
            ) : (
              <Ionicons
                name="open-outline"
                size={18}
                color={color.text.secondary}
              />
            )}
            <Text style={[text.label, { color: color.text.primary, flex: 1 }]}>
              {t("managePayouts")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={color.text.tertiary}
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/* ── Statistics — total earnings as a featured card, the rest in a 2-col grid of
   icon-row cards (icon beside a stacked value + label). ───────────────────────── */

type StatItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Optional ≈ CZK secondary line (CZ locale only; "" otherwise). */
  subValue?: string;
  /** Money stats render green (earnings); counts stay neutral. */
  money: boolean;
  /** When set, the stat is pressable and navigates here. */
  route?: string;
  /** When set (and no `route`), the stat is pressable and runs this instead
   *  (e.g. open an info sheet) — rendered with an info icon, not a chevron. */
  onPress?: () => void;
};

/** Builds the labeled + icon-tagged stat list from the raw statistics. */
function useStatItems(
  stats: CustomerStatistics,
  onMultiplierInfo: () => void,
): StatItem[] {
  const { t } = useTranslation("account");
  const formatBudget = useFormatBudget();
  const { customer } = useCustomer();
  const multiplierBps = customer?.sensitiveData.multiplierBps ?? 10000;
  return [
    {
      key: "earned",
      icon: "cash-outline",
      label: t("statTotalEarned"),
      value: formatBudget(stats.totalRewardsCents),
      money: true,
      route: "/transactions",
    },
    {
      key: "shares",
      icon: "camera-outline",
      label: t("statShares"),
      value: stats.totalShares.toLocaleString(),
      money: false,
      route: "/shares",
    },
    {
      key: "places",
      icon: "storefront-outline",
      label: t("statPlaces"),
      value: stats.visitedPlaces.toLocaleString(),
      money: false,
      route: "/visited",
    },
    {
      key: "reach",
      icon: "people-outline",
      label: t("statReach"),
      value: stats.totalReachCount.toLocaleString(),
      money: false,
    },
    {
      key: "avg",
      icon: "trending-up-outline",
      label: t("statAvgReward"),
      value: formatBudget(stats.averageRewardPerShareCents),
      money: true,
    },
    {
      key: "multiplier",
      icon: "star-outline",
      label: t("statMultiplier"),
      value: `${(multiplierBps / 10000).toFixed(2)}×`,
      money: false,
      onPress: onMultiplierInfo,
    },
  ];
}

/** The tinted icon circle — green for money stats, soft blue for counts. */
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

function StatsDisplay({ stats }: { stats: CustomerStatistics }) {
  const [multiplierInfoOpen, setMultiplierInfoOpen] = useState(false);
  const items = useStatItems(stats, () => setMultiplierInfoOpen(true));
  const featured = items[0];
  const rest = items.slice(1);
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout, shadow } = theme;

  // A card is pressable when its stat has a route; pressing navigates there with
  // the shared press feedback, and shows a forward chevron.
  const pressableStyle =
    (base: object) =>
    ({ pressed }: { pressed: boolean }) => ({
      ...base,
      ...pressFeedbackStyle({ pressed }),
    });

  return (
    <View style={{ gap: spacing.md }}>
      {/* Featured — total earned → transactions history. */}
      {(() => {
        const base = {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: spacing.md,
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
        };
        const body = (
          <>
            <StatIconChip icon={featured.icon} money size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {featured.label}
              </Text>
              <Text
                style={[text.amount, { color: color.success }]}
                numberOfLines={1}
              >
                {featured.value}
              </Text>
              {featured.subValue ? (
                <Text
                  style={[text.caption, { color: color.text.tertiary }]}
                  numberOfLines={1}
                >
                  {featured.subValue}
                </Text>
              ) : null}
            </View>
            {featured.route ? (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={color.text.tertiary}
              />
            ) : null}
          </>
        );
        return featured.route ? (
          <Pressable
            onPress={() => router.push(featured.route as never)}
            style={pressableStyle(base)}
          >
            {body}
          </Pressable>
        ) : (
          <View style={base}>{body}</View>
        );
      })()}

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
                  style={[
                    text.bodyMedium,
                    { color: it.money ? color.success : color.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {it.value}
                </Text>
                {/* Labels wrap (e.g. "Places visited" / "Navštívená místa") so
                    they're never clipped by the chevron. */}
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
              ) : it.onPress ? (
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={color.text.tertiary}
                />
              ) : null}
            </>
          );
          const onItemPress = it.route
            ? () => router.push(it.route as never)
            : it.onPress;
          return onItemPress ? (
            <Pressable
              key={it.key}
              onPress={onItemPress}
              style={pressableStyle(base)}
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

      {/* Reward-multiplier explainer (opened from the multiplier stat). */}
      <BottomSheet
        open={multiplierInfoOpen}
        onClose={() => setMultiplierInfoOpen(false)}
      >
        <MultiplierExplainer
          value={items.find((it) => it.key === "multiplier")?.value ?? ""}
        />
      </BottomSheet>
    </View>
  );
}

/* ── Reward-multiplier explainer — a 3-step "share → review → moves" timeline
   (like origin/main), the up/down rule, and the current value. ──────────────── */
function MultiplierExplainer({ value }: { value: string }) {
  const { t } = useTranslation("account");
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const CIRCLE = 44;

  const steps: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { icon: "camera-outline", label: t("multiplierStep1") },
    { icon: "thumbs-up-outline", label: t("multiplierStep2") },
    { icon: "trending-up-outline", label: t("multiplierStep3") },
  ];

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("multiplierInfoTitle")}{" "}
          <Ionicons name="star" size={20} color={color.ink} />
        </Text>
        <Text style={[text.body, { color: color.text.secondary }]}>
          {t("multiplierInfoBody")}
        </Text>
      </View>

      {/* Horizontal timeline: icon circles joined by connectors. */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 ? (
              <View
                style={{
                  height: 2,
                  flex: 0.5,
                  marginTop: CIRCLE / 2 - 1, // align with circle centers
                  backgroundColor: color.border.divider,
                }}
              />
            ) : null}
            <View style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
              <View
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: radius.pill,
                  backgroundColor: color.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={s.icon} size={22} color={color.on.accent} />
              </View>
              <Text
                style={[
                  text.caption,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
                numberOfLines={2}
              >
                {s.label}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>

      {/* The up/down rule — it can drop below 1× for low-quality / fake posts. */}
      <Text style={[text.body, { color: color.text.secondary }]}>
        {t("multiplierUpDown")}
      </Text>
    </View>
  );
}
