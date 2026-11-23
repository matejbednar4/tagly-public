import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import {
  BottomSheet,
  BusinessPreview,
  consumePendingStoreReview,
  pressFeedbackStyle,
  RewardInfoSheet,
  spacing as spacingTokens,
  TopMenu,
  useCurrentLocation,
  useFormatBudget,
  useTheme,
  useTimeRemaining,
  withAlpha,
} from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { CustomerShareStatus } from "@tagly/models/shared";
import type { CustomerShareDetails } from "@tagly/models/v2/customerApp";
import { useShare } from "@/hooks/details/useShare";

/** Largest the story media is allowed to get tall; its width is derived from the
 *  aspect ratio (and capped to the screen), so portrait stories stay readable and
 *  the occasional landscape one never overflows the screen edges. */
const HERO_MAX_HEIGHT = 460;

/** The reward maturation window — a story can only be paid once it's at least 24h
 *  old (mirrors the backend payment gate `minPaymentAgeMs`). Used purely to render
 *  the "reward in …" countdown; the server stays the source of truth. */
const REWARD_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Localized date-only ("MMM D, YYYY" / "D. MMMM YYYY"), matching `formatDate`. */
const fmtDate = (d: string | Date) =>
  dayjs(d).format(dayjs.locale() === "cs" ? "D. MMMM YYYY" : "MMM D, YYYY");

/** The insight metrics' i18n label keys (shared by the headline stats + the
 *  "all insights" sheet rows). */
type MetricKey =
  | "metricReach"
  | "metricViews"
  | "metricReplies"
  | "metricProfileVisits"
  | "metricFollows"
  | "metricShares"
  | "metricInteractions";

/** Headline-metric icon — reach reads as the audience it reached, views as an eye,
 *  interactions as engagement; any other fallback metric gets a generic chart glyph. */
const HEADLINE_METRIC_ICON: Partial<
  Record<MetricKey, keyof typeof Ionicons.glyphMap>
> = {
  metricReach: "people-outline",
  metricViews: "eye-outline",
  metricInteractions: "pulse-outline",
};

/**
 * Share detail screen (`/shares/:uid`) — the logged-in customer's own share,
 * fetched + ETag-cached via `useShare`. Built around the story media (a hero card
 * sized from its own aspect ratio), then a stack of sections, each rendered only
 * when it applies: a tappable Status block (progress timeline; opens the lifecycle
 * sheet), a red Report callout when a business reported it, the advertiser's star
 * Rating, the Reward (estimate → final payout, with a live "reward in …" countdown
 * while it matures), the story's Instagram insights (headline metric + a full
 * table), and a link back to the business. Reached from share previews / "View
 * share", and as the landing screen
 * right after creating a share — so it also consumes a queued store-review prompt
 * on mount (a no-op otherwise).
 */
export default function ShareDetailsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("shareDetails");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const { width: screenWidth } = useWindowDimensions();
  const { currentLocation } = useCurrentLocation();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useShare(
    uid ?? "",
    router,
  );

  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [reportInfoOpen, setReportInfoOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // The create flow lands here after a successful monetize, so consume any queued
  // store-review prompt now that we're on a stable screen (self-throttled, no-op
  // when nothing's queued). Deferred past the navigation transition.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void consumePendingStoreReview();
    });
    return () => task.cancel();
  }, []);

  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: layout.screenPadding,
          }}
        >
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("error")}
          </Text>
        </View>
      </View>
    );
  }

  const businessName = data.local?.name ?? t("thisBusiness");

  // Customer-facing status → a short label + its color: PAID (finished) reads
  // brand-gold, the in-flight/review holds read accent-blue, the two terminal
  // failures (REJECTED, UNPAYABLE) red. Text uses the readable on.* variants (the
  // brand/accent fills themselves are too pale for type). The card carries no
  // per-status sentence (only a failure reason for the terminal cases) — the
  // timeline + lifecycle sheet explain the rest.
  const statusUi = ((): { label: string; fg: string } => {
    switch (data.status) {
      case "PAID":
        return { label: t("statusPaid"), fg: color.on.brand };
      case "REJECTED":
        return { label: t("statusRejected"), fg: color.danger };
      case "UNPAYABLE":
        return { label: t("statusUnpayable"), fg: color.danger };
      // The two "review" holds get distinct labels — the intake gate is a neutral
      // "under review", but a REPORT_REVIEW must say so on the status itself (the
      // user has to understand a business reported them), reinforced by the red
      // Report section below. Both read accent-blue: the reward may still be paid.
      case "UNDER_REVIEW":
        return { label: t("statusUnderReview"), fg: color.on.accent };
      case "REPORT_REVIEW":
        return { label: t("statusReported"), fg: color.on.accent };
      default:
        return { label: t("statusProcessing"), fg: color.on.accent };
    }
  })();

  const isPaid = data.status === "PAID";
  const isFailed = data.status === "REJECTED" || data.status === "UNPAYABLE";
  // Two report states: a pending report (REPORT_REVIEW) and an upheld report (a
  // VALID report → REJECTED, but approvalStatus stayed APPROVED). Both surface the
  // red report section; only the upheld one is also a failure. An upheld report is
  // inferred from REJECTED with no rejectionReason — an intake reject always carries
  // an admin reason, while a report-upheld rejection deliberately has none.
  const isReportPending = data.status === "REPORT_REVIEW";
  const isReportUpheld =
    data.status === "REJECTED" && data.rejectionReason == null;
  const isReported = isReportPending || isReportUpheld;

  // Why a voided share failed — the backend's `voidReason` slug mapped to
  // localized copy. Unknown/null slugs (pre-column voids) and ACCOUNT_DELETED
  // (the owner can't be reading this screen) fall back to the generic line.
  const unpayableDesc = (() => {
    switch (data.voidReason) {
      case "IG_DISCONNECTED":
        return t("statusUnpayableDescIgDisconnected");
      case "IG_DATA_DELETED":
        return t("statusUnpayableDescIgDataDeleted");
      case "INSIGHTS_UNAVAILABLE":
        return t("statusUnpayableDescInsightsUnavailable");
      case "SETTLEMENT_FAILED":
        return t("statusUnpayableDescSettlementFailed");
      default:
        return t("statusUnpayableDesc");
    }
  })();

  // Shown on the status card only for a plain intake rejection / payout failure —
  // the report cases (pending or upheld) get the dedicated red report section, so
  // we don't also repeat a reason line here.
  const failureReason =
    data.status === "REJECTED" && !isReportUpheld
      ? (data.rejectionReason ?? t("statusRejectedDesc"))
      : data.status === "UNPAYABLE"
        ? unpayableDesc
        : null;

  // The lifecycle steps for this share. A reported share gets a "report review"
  // step (placed by whether insights are captured); an upheld report marks that
  // step failed (Review stays done — approval was never revoked).
  const stages = buildLifecycleStages(
    data.status,
    data.insights != null,
    isReportUpheld,
  );

  // Hero size: cap the height, derive width from the media's aspect ratio, and
  // never exceed the available content width — handles portrait stories AND the
  // odd landscape one without overflow or a double aspect-ratio constraint.
  const availW = screenWidth - layout.screenPadding * 2;
  const ar = data.media.aspectRatio || 1;
  const heroW = Math.min(availW, HERO_MAX_HEIGHT * ar);
  const heroH = heroW / ar;

  // Story performance. Every metric Instagram actually reported (non-null), in
  // display order — the full table behind the "See all" sheet.
  const allMetrics = data.insights
    ? (
        [
          ["metricReach", data.insights.reach],
          ["metricViews", data.insights.views],
          ["metricReplies", data.insights.replies],
          ["metricProfileVisits", data.insights.profileVisits],
          ["metricFollows", data.insights.follows],
          ["metricShares", data.insights.shares],
          ["metricInteractions", data.insights.totalInteractions],
        ] as const
      ).filter(([, v]) => v != null)
    : [];

  // The single headline metric. Reach by default, but Instagram sometimes returns
  // reach as 0 or omits it — so fall back to views (then to whatever else is
  // present) rather than headlining a broken 0. Null only when no metric exists yet.
  const reachVal = data.insights?.reach ?? null;
  const viewsVal = data.insights?.views ?? null;
  const mainMetric: { key: MetricKey; value: number } | null =
    reachVal != null && reachVal > 0
      ? { key: "metricReach", value: reachVal }
      : viewsVal != null && viewsVal > 0
        ? { key: "metricViews", value: viewsVal }
        : reachVal != null
          ? { key: "metricReach", value: reachVal }
          : viewsVal != null
            ? { key: "metricViews", value: viewsVal }
            : allMetrics.length > 0
              ? { key: allMetrics[0][0], value: allMetrics[0][1] as number }
              : null;

  // Second headline stat — total interactions, shown next to reach/views when
  // Instagram reported it (and it isn't already the headline metric).
  const interactionsVal = data.insights?.totalInteractions ?? null;
  const secondaryMetric: { key: MetricKey; value: number } | null =
    interactionsVal != null && mainMetric?.key !== "metricInteractions"
      ? { key: "metricInteractions", value: interactionsVal }
      : null;

  // The advertiser's quality rating as half-stars (1–10 = ½★–5★); null = unrated,
  // which hides the Rating section (see that section for the full when/why).
  const ratingStars = data.ratingStars;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("title")}
        showBack
        subheading={t("fromBusiness", { business: businessName })}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.xl,
        }}
        refreshControl={
          // Status moves server-side (insights land, payment settles, a report is
          // reviewed) — pull-to-refresh lets the user re-pull on demand. The
          // endpoint always returns a fresh body (no ETag layer), so a refetch
          // reflects those transitions immediately.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={color.text.tertiary}
          />
        }
      >
        {/* ---- Hero: the story media, sized from its own aspect ratio ---- */}
        <View
          style={{
            alignSelf: "center",
            width: heroW,
            height: heroH,
            borderRadius: radius.structure,
            overflow: "hidden",
            boxShadow: shadow.card,
          }}
        >
          {/* Pass both media + thumbnail: a video shows its poster frame with a
              "hold to play" affordance; an image ignores the thumbnail. */}
          <CustomMedia
            media={data.media}
            thumbnail={data.thumbnail}
            style={{ flex: 1 }}
            backgroundColor={color.ink}
          />
        </View>

        {/* ---- Status — a compact progress timeline; tap for the full lifecycle ---- */}
        <Section title={t("statusHeading")} text={text} color={color}>
          <Pressable
            onPress={() => setLifecycleOpen(true)}
            accessibilityRole="button"
            style={({ pressed, hovered }) => [
              {
                padding: layout.cardPadding,
                borderRadius: radius.structure,
                backgroundColor: color.surface,
                boxShadow: shadow.card,
                gap: spacing.md,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            {/* Headline: the status name + an info affordance opening the sheet. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Text style={[text.bodyMedium, { color: statusUi.fg, flex: 1 }]}>
                {statusUi.label}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={color.text.tertiary}
              />
            </View>

            {/* The progress timeline — same node marking as the sheet (gains a
                report-review node for a reported share). */}
            <StatusTimeline stages={stages} />

            {/* Why it failed — only for the terminal failures. */}
            {failureReason && (
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {failureReason}
              </Text>
            )}
          </Pressable>
        </Section>

        {/* ---- Report — cardless: a danger-tinted flag chip + a short red line
            directly on the cream (no filled card). Tap (or the info icon) opens the
            sheet with the full "why". ---- */}
        {isReported && (
          <Section
            title={t(isReportUpheld ? "reportUpheldTitle" : "reportTitle")}
            text={text}
            color={color}
          >
            <Pressable
              onPress={() => setReportInfoOpen(true)}
              accessibilityRole="button"
              style={({ pressed, hovered }) => [
                { flexDirection: "row", alignItems: "center", gap: spacing.md },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(color.danger, 0.12),
                }}
              >
                <Ionicons name="flag" size={22} color={color.danger} />
              </View>
              <Text style={[text.bodyMedium, { color: color.danger, flex: 1 }]}>
                {t(isReportUpheld ? "reportUpheldShort" : "reportShort")}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={color.danger}
              />
            </Pressable>
          </Section>
        )}

        {/* ---- Rating — the advertiser's quality feedback as a half-star score.
            Cardless: the stars sit directly on the cream (like the business screen's
            identity block) so they break up the white status/reward cards rather
            than stacking a third square. The big serif value reads as the headline.
            Always shown when a rating exists (ratingStars != null). A reported share
            carries no rating (reporting clears it — the two are mutually exclusive),
            but a rated-then-unpayable share, or one whose report was dismissed with a
            rating, keeps a real score the customer earned and should still see. ---- */}
        {ratingStars != null && (
          <Section title={t("ratingTitle")} text={text} color={color}>
            {/* No gap — each star pads itself so its text shadow isn't clipped by
                the glyph's tight text frame (RN clips text shadows to it), and that
                padding doubles as the inter-star spacing. The negative marginLeft
                cancels the first star's pad so the row stays flush with the title. */}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.xs,
              }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const filled = ratingStars >= (i + 1) * 2;
                const half = !filled && ratingStars === i * 2 + 1;
                const lit = filled || half;
                return (
                  <Ionicons
                    key={i}
                    name={filled ? "star" : half ? "star-half" : "star-outline"}
                    size={30}
                    color={
                      lit ? color.ink : withAlpha(color.text.secondary, 0.4)
                    }
                    // Padding gives the warm text shadow room; lit stars are
                    // raised gold (butter + shadow.text).
                    style={[{ paddingBottom: spacing.xs }, lit && shadow.text]}
                  />
                );
              })}
            </View>
          </Section>
        )}

        {/* ---- Reward — hidden for failed shares (there's no reward) ---- */}
        {!isFailed && (
          <Section title={t("rewardTitle")} text={text} color={color}>
            <RewardCard share={data} paid={isPaid} />
            {/* Quiet "reward in Xh Ym" label while the reward window matures. The
                REPORT_REVIEW hold is explained by the dedicated Report section above,
                so no extra note here. */}
            {data.status === "PROCESSING" && (
              <RewardTimer createdAt={data.createdAt} />
            )}
          </Section>
        )}

        {/* ---- Insights — cardless: soft-blue metric chips for the headline stats
            (reach/views + interactions) directly on the cream, with a subdued
            "See all" link in the heading opening the full table. Cardless on purpose,
            to break up the white status/reward cards. ---- */}
        <Section
          title={t("insightsTitle")}
          text={text}
          color={color}
          right={
            mainMetric ? (
              <Pressable
                onPress={() => setInsightsOpen(true)}
                accessibilityRole="button"
                style={({ pressed, hovered }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Text style={[text.label, { color: color.text.secondary }]}>
                  {t("seeAllInsights")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={color.text.secondary}
                />
              </Pressable>
            ) : undefined
          }
        >
          {mainMetric ? (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <InsightStat
                metricKey={mainMetric.key}
                value={mainMetric.value}
              />
              {secondaryMetric && (
                <InsightStat
                  metricKey={secondaryMetric.key}
                  value={secondaryMetric.value}
                />
              )}
            </View>
          ) : (
            <Text style={[text.body, { color: color.text.secondary }]}>
              {t("insightsPending")}
            </Text>
          )}
        </Section>

        {/* ---- Business — the canonical preview card + a "Share again" CTA. Last
            block; the card owns its own navigation + share-create routing. ---- */}
        {data.business && (
          <Section title={t("businessHeading")} text={text} color={color}>
            <BusinessPreview
              business={data.business}
              width={screenWidth - layout.screenPadding * 2}
              currentLocation={
                currentLocation
                  ? {
                      lat: currentLocation.latitude,
                      lon: currentLocation.longitude,
                    }
                  : null
              }
              showEarnButton
              earnButtonLabel={t("shareAgain")}
            />
          </Section>
        )}
      </ScrollView>

      <LifecycleSheet
        open={lifecycleOpen}
        onClose={() => setLifecycleOpen(false)}
        stages={stages}
      />

      {/* Report explainer — the full "why" behind the red callout. */}
      <BottomSheet
        open={reportInfoOpen}
        onClose={() => setReportInfoOpen(false)}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t(isReportUpheld ? "reportUpheldInfoTitle" : "reportInfoTitle")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t(isReportUpheld ? "reportUpheldInfoBody" : "reportInfoBody")}
          </Text>
        </View>
      </BottomSheet>

      {/* All insights — the full metric table behind the Performance card. */}
      <BottomSheet open={insightsOpen} onClose={() => setInsightsOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("insightsSheetTitle")}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          {allMetrics.map(([key, value], i) => (
            <View
              key={key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.md,
                // Hairline divider between rows (allowed inside a card); none above
                // the first row.
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: color.border.divider,
              }}
            >
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t(key)}
              </Text>
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {(value as number).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

/** Titled section block — mirrors the business-detail screen's `Section`, with an
 *  optional `right` control aligned to the heading (e.g. a "See all" link). */
function Section({
  title,
  right,
  children,
  text,
  color,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  text: ReturnType<typeof useTheme>["theme"]["text"];
  color: ReturnType<typeof useTheme>["theme"]["color"];
}) {
  return (
    <View style={{ marginHorizontal: spacingTokens.lg, gap: spacingTokens.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[text.heading, { color: color.text.primary }]}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** One cardless headline insight — a soft-blue accent chip (icon by metric, same
 *  "count" tone as the account stats) plus the big count over its label. Up to two
 *  sit side by side in the Insights section; the rest live in the "See all" sheet. */
function InsightStat({
  metricKey,
  value,
}: {
  metricKey: MetricKey;
  value: number;
}) {
  const { t } = useTranslation("shareDetails");
  const { theme } = useTheme();
  const { color, text, radius, spacing } = theme;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(color.accent, 0.55),
        }}
      >
        <Ionicons
          name={HEADLINE_METRIC_ICON[metricKey] ?? "stats-chart-outline"}
          size={24}
          color={color.on.accent}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[text.amount, { color: color.text.primary }]}
          numberOfLines={1}
        >
          {value.toLocaleString()}
        </Text>
        <Text
          style={[text.caption, { color: color.text.secondary }]}
          numberOfLines={1}
        >
          {t(metricKey)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reward card — a compact row: an icon medallion on the left, then the eyebrow +
// amount + a clarity sub-line. An estimate spells out the reach it's based on
// ("for ~5,000 reach") so it's unmistakable the figure is *for* that reach; a
// paid reward turns the card success-green and shows when it landed.
// ---------------------------------------------------------------------------

function RewardCard({
  share,
  paid,
}: {
  share: CustomerShareDetails;
  paid: boolean;
}) {
  const { t } = useTranslation("shareDetails");
  const { theme } = useTheme();
  const { color, text, radius, shadow, layout, spacing } = theme;
  const formatBudget = useFormatBudget();
  const [infoOpen, setInfoOpen] = useState(false);
  const reach = share.estimatedAverageReach;
  const cents = paid
    ? (share.finalRewardCents ?? share.estimatedRewardCents)
    : share.estimatedRewardCents;

  // Sub-line under the amount: an estimate ties the figure to its reach; a paid
  // reward shows when it landed.
  const sub = paid
    ? t("paidOn", { date: fmtDate(share.paidAt ?? share.createdAt) })
    : reach !== null
      ? t("reachNote", { reach: reach.toLocaleString() })
      : null;

  return (
    <>
      <Pressable
        onPress={() => setInfoOpen(true)}
        accessibilityRole="button"
        style={({ pressed, hovered }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: color.surface,
            borderRadius: radius.structure,
            padding: layout.cardPadding,
            boxShadow: shadow.card,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        {/* Icon medallion — a success-tinted money glyph. The card is white now, so
            green lives only on the icon + the amount (money keeps its one color). */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(color.success, 0.14),
          }}
        >
          <Ionicons name="cash-outline" size={22} color={color.success} />
        </View>

        <View style={{ flex: 1, gap: spacing.xs / 2 }}>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {paid ? t("rewardEarnedEyebrow") : t("rewardEstimateShort")}
          </Text>
          <Text style={[text.amountLg, { color: color.success }]}>
            {formatBudget(cents)}
          </Text>
          {sub && (
            <Text
              style={[
                text.caption,
                // Pull the sub-line up into the big number's line-box descent so
                // the gap below the amount matches the gap above it — `amountLg`
                // carries a tall line height that reads as extra space underneath.
                { color: color.text.secondary, marginTop: -spacing.sm },
              ]}
            >
              {sub}
            </Text>
          )}
        </View>

        <Ionicons
          name="information-circle-outline"
          size={20}
          color={color.text.tertiary}
        />
      </Pressable>

      <RewardInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Reward timer — a quiet "reward in Xh Ym" label under the reward card while a
// share is processing.
// ---------------------------------------------------------------------------

/**
 * Live countdown to when the reward matures (createdAt + 24h), rendered as a
 * small caption: a clock + "Reward in 5h 23m" (localized h/m), swapping to the
 * "reward coming soon" line (`rewardSoon`) once the 24h window has elapsed. Owns
 * its own `useTimeRemaining` so only this label re-renders each tick.
 */
function RewardTimer({ createdAt }: { createdAt: string }) {
  const { t } = useTranslation("shareDetails");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const msLeft = useTimeRemaining(
    new Date(createdAt).getTime() + REWARD_WINDOW_MS,
  );

  // Compact "5h 23m" / "5 h 23 min" (Czech spaces its units); always ≥ 1m while
  // ms > 0, since we ceil.
  const cs = dayjs.locale() === "cs";
  const totalMin = Math.ceil(msLeft / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(cs ? `${h} h` : `${h}h`);
  if (m > 0 || h === 0) parts.push(cs ? `${m} min` : `${m}m`);
  const time = parts.join(" ");

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
    >
      <Ionicons
        name={msLeft > 0 ? "time-outline" : "hourglass-outline"}
        size={15}
        color={color.text.tertiary}
      />
      <Text style={[text.caption, { color: color.text.secondary }]}>
        {msLeft > 0 ? t("rewardCountdown", { time }) : t("rewardSoon")}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle steps — the path every story walks (shared → review → measuring →
// reward), with the current step highlighted and any failure marked. A reported
// share gets an extra "report review" step inserted where the report actually sits
// in the flow. Used by both the compact status timeline and the full lifecycle
// sheet, but only on this screen — so it's kept here, not extracted to a shared
// module (per the "inline single-use" rule).
// ---------------------------------------------------------------------------

type StageKey = "shared" | "review" | "measuring" | "reportReview" | "reward";
type StageState = "done" | "active" | "failed" | "upcoming";
type Stage = {
  key: StageKey;
  icon: keyof typeof Ionicons.glyphMap;
  state: StageState;
};

const STAGE_ICON: Record<StageKey, keyof typeof Ionicons.glyphMap> = {
  shared: "share-social",
  review: "shield-checkmark",
  measuring: "stats-chart",
  reportReview: "flag",
  reward: "wallet",
};

/**
 * The ordered lifecycle steps + their states for a customer status. Normally four
 * (shared → review → measuring → reward). A reported share inserts a fifth "report
 * review" step where the report sits in the flow: AFTER measuring once the story's
 * insights are in, otherwise BEFORE it (the report landed before measuring).
 *
 * REJECTED has two shapes: an intake reject marks "review" failed; a report-upheld
 * reject (`rejectedByReport`) keeps "review" done (approval was never revoked) and
 * marks the inserted "report review" step failed instead. A payout failure marks
 * "reward".
 */
function buildLifecycleStages(
  status: CustomerShareStatus,
  hasInsights: boolean,
  rejectedByReport: boolean,
): Stage[] {
  const s = (key: StageKey, state: StageState): Stage => ({
    key,
    icon: STAGE_ICON[key],
    state,
  });

  // Report step placed by whether the story was measured; `st` is its state
  // (active while pending, failed once upheld). Shared by REPORT_REVIEW + the
  // report-upheld REJECTED branch so the two render identically except the marker.
  const withReportStep = (st: StageState): Stage[] =>
    hasInsights
      ? [
          s("shared", "done"),
          s("review", "done"),
          s("measuring", "done"),
          s("reportReview", st),
          s("reward", "upcoming"),
        ]
      : [
          s("shared", "done"),
          s("review", "done"),
          s("reportReview", st),
          s("measuring", "upcoming"),
          s("reward", "upcoming"),
        ];

  switch (status) {
    case "PAID":
      return [
        s("shared", "done"),
        s("review", "done"),
        s("measuring", "done"),
        s("reward", "done"),
      ];
    case "PROCESSING":
      return [
        s("shared", "done"),
        s("review", "done"),
        s("measuring", "active"),
        s("reward", "upcoming"),
      ];
    case "UNDER_REVIEW":
      return [
        s("shared", "done"),
        s("review", "active"),
        s("measuring", "upcoming"),
        s("reward", "upcoming"),
      ];
    case "REPORT_REVIEW":
      // The report is the active hold.
      return withReportStep("active");
    case "REJECTED":
      // Report upheld → report step failed (review stays done); else intake reject.
      return rejectedByReport
        ? withReportStep("failed")
        : [
            s("shared", "done"),
            s("review", "failed"),
            s("measuring", "upcoming"),
            s("reward", "upcoming"),
          ];
    case "UNPAYABLE":
      return [
        s("shared", "done"),
        s("review", "done"),
        s("measuring", "done"),
        s("reward", "failed"),
      ];
    default:
      return [
        s("shared", "done"),
        s("review", "active"),
        s("measuring", "upcoming"),
        s("reward", "upcoming"),
      ];
  }
}

/** Theme color tokens — for the module-level node helpers shared by the status
 *  card timeline and the lifecycle sheet. */
type ThemeColor = ReturnType<typeof useTheme>["theme"]["color"];

/** Per-state node badge — each step keeps its own glyph; the paired status-badge
 *  tokens carry the meaning by color: brand (butter) = done, accent (blue) = the
 *  current step, a muted neutral = upcoming. Only a real failure swaps in a red ✕.
 *  Each fill pairs with its readable on.* glyph color. Shared so the card + sheet
 *  stay marked identically. */
function stageBadge(
  state: StageState,
  stageIcon: keyof typeof Ionicons.glyphMap,
  color: ThemeColor,
): { bg: string; icon: keyof typeof Ionicons.glyphMap; fg: string } {
  switch (state) {
    case "done":
      return { bg: color.brand, icon: stageIcon, fg: color.on.brand };
    case "active":
      return { bg: color.accent, icon: stageIcon, fg: color.on.accent };
    case "failed":
      return { bg: color.dangerBg, icon: "close", fg: color.on.dangerBg };
    default:
      return {
        bg: withAlpha(color.text.tertiary, 0.12),
        icon: stageIcon,
        fg: color.text.tertiary,
      };
  }
}

/** A connector segment is "travelled" (a solid brand line) once its preceding node
 *  is done, else faint — so progress visibly stops at the current step. Uses the
 *  on.brand gold (not the pale butter fill) so the thin line stays visible. */
function connectorColorFor(state: StageState, color: ThemeColor): string {
  return state === "done" ? color.on.brand : color.border.strong;
}

/**
 * Compact horizontal progress timeline for the status card — the same node
 * marking as the lifecycle sheet (done ✓ / current / failed ✕ / upcoming) with
 * green-vs-faint connectors, but no labels: the card just shows where the share
 * is, and the sheet (opened from the card) carries the explanation.
 */
function StatusTimeline({ stages }: { stages: Stage[] }) {
  const { theme } = useTheme();
  const { color, radius } = theme;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {stages.map((stage, i) => {
        const badge = stageBadge(stage.state, stage.icon, color);
        const isLast = i === stages.length - 1;
        return (
          <Fragment key={stage.key}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: badge.bg,
              }}
            >
              <Ionicons name={badge.icon} size={16} color={badge.fg} />
            </View>
            {!isLast && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginHorizontal: spacingTokens.xs,
                  borderRadius: radius.pill,
                  backgroundColor: connectorColorFor(stage.state, color),
                }}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

function LifecycleSheet({
  open,
  onClose,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
}) {
  const { t } = useTranslation("shareDetails");
  const { theme } = useTheme();
  const { color, text, radius, spacing } = theme;

  const titleColor = (state: StageState) =>
    state === "failed"
      ? color.danger
      : state === "upcoming"
        ? color.text.tertiary
        : color.text.primary;

  // Stage description — failure states get their own copy.
  const descFor = (key: StageKey, state: StageState): string => {
    if (state === "failed" && key === "review") return t("lcReviewFailedDesc");
    if (state === "failed" && key === "reward") return t("lcRewardFailedDesc");
    if (state === "failed" && key === "reportReview")
      return t("lcReportFailedDesc");
    if (key === "reportReview") return t("lc_reportReview_desc");
    if (key === "shared") return t("lc_shared_desc");
    if (key === "review") return t("lc_review_desc");
    if (key === "measuring") return t("lc_measuring_desc");
    return t("lc_reward_desc");
  };

  const titleFor = (key: StageKey): string => {
    if (key === "reportReview") return t("lc_reportReview_title");
    if (key === "shared") return t("lc_shared_title");
    if (key === "review") return t("lc_review_title");
    if (key === "measuring") return t("lc_measuring_title");
    return t("lc_reward_title");
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.xs }}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("lifecycleTitle")}
        </Text>
        <Text style={[text.body, { color: color.text.secondary }]}>
          {t("lifecycleSubtitle")}
        </Text>
      </View>

      <View>
        {stages.map((stage, i) => {
          const state = stage.state;
          const badge = stageBadge(state, stage.icon, color);
          const isLast = i === stages.length - 1;
          return (
            <View
              key={stage.key}
              style={{
                flexDirection: "row",
                gap: spacing.md,
                // Future steps recede — the clearest "hasn't happened yet" cue.
                opacity: state === "upcoming" ? 0.55 : 1,
              }}
            >
              {/* Left rail: the node + the connector line down to the next one. */}
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: badge.bg,
                  }}
                >
                  <Ionicons name={badge.icon} size={18} color={badge.fg} />
                </View>
                {!isLast && (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: spacing.md,
                      marginVertical: spacing.xs,
                      borderRadius: radius.pill,
                      backgroundColor: connectorColorFor(stage.state, color),
                    }}
                  />
                )}
              </View>

              {/* Content — its paddingBottom carries the gap to the next row, so
                  the rail's connector line stretches across it. */}
              <View
                style={{
                  flex: 1,
                  paddingBottom: isLast ? 0 : spacing.lg,
                  gap: spacing.xs / 2,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Text style={[text.bodyMedium, { color: titleColor(state) }]}>
                    {titleFor(stage.key)}
                  </Text>
                  {state === "active" && (
                    <View
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        borderRadius: radius.pill,
                        backgroundColor: color.accent,
                      }}
                    >
                      <Text style={[text.micro, { color: color.on.accent }]}>
                        {t("lcInProgress")}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {descFor(stage.key, state)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}
