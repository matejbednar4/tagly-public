import { Fragment, useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import {
  BottomSheet,
  RewardInfoSheet,
  TopMenu,
  callAuthed,
  pressFeedbackStyle,
  spacing as spacingTokens,
  useFormatBudget,
  useTheme,
  useTimeRemaining,
  withAlpha,
} from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { AdvertiserShareStatus } from "@tagly/models/shared";
import type { AdvertiserShareDetails } from "@tagly/models/v2/advertiserApp";
import { getShareByUid } from "@tagly/sdk/v2/advertiserApp";
import { StarRating } from "@tagly/client";
import { ShareAssessmentSheet } from "@/components/shares/ShareAssessmentSheet";
import { useAdvertiserShareStatusDisplay } from "@/components/shares/shared/useShareStatusDisplay";

/** Largest the story media is allowed to get tall; width derives from the aspect
 *  ratio (capped to the screen), so portrait stories stay readable and a landscape
 *  one never overflows. Mirrors the customer detail. */
const HERO_MAX_HEIGHT = 460;

/** Settlement window — a share settles (the advertiser is charged) once it's at
 *  least 24h old (backend `minPaymentAgeMs`). Drives the "charged in …" countdown;
 *  the server stays the source of truth. */
const SETTLE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Localized date-only ("MMM D, YYYY" / "D. MMMM YYYY"). */
const fmtDate = (d: string | Date) =>
  dayjs(d).format(dayjs.locale() === "cs" ? "D. MMMM YYYY" : "MMM D, YYYY");

/** The insight metrics' i18n label keys (shared by the headline stats + the
 *  "all insights" sheet). */
type MetricKey =
  | "metricReach"
  | "metricViews"
  | "metricReplies"
  | "metricProfileVisits"
  | "metricFollows"
  | "metricShares"
  | "metricInteractions";

const HEADLINE_METRIC_ICON: Partial<
  Record<MetricKey, keyof typeof Ionicons.glyphMap>
> = {
  metricReach: "people-outline",
  metricViews: "eye-outline",
  metricInteractions: "pulse-outline",
};

/**
 * Advertiser share detail (`/shares/:uid`) — the advertiser's own share, built as
 * a near-twin of the customer detail: the story media as a hero, a tappable Status
 * block (progress timeline → lifecycle sheet), a Report callout when they reported
 * it, their star Rating, the Spend (estimate → final, with a "charged in …"
 * countdown while it settles), and the story's Instagram insights.
 *
 * Insights are shown here (unlike previews / the rate sheet) because the screen is
 * **rating-gated**: an unassessed share opens the assessment sheet non-dismissably,
 * so the performance figures can't be seen — and can't bias the rating — until the
 * share has been rated or reported. There is no business section (the advertiser
 * owns the business; the DTO carries only its name).
 */
export default function ShareDetailScreen() {
  const { t } = useTranslation("shareDetail");
  const { t: tShares } = useTranslation("shares");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [share, setShare] = useState<AdvertiserShareDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [reportInfoOpen, setReportInfoOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // The one canonical status identity (label/tone), shared with the preview
  // card's pill. Called before the early returns (rules of hooks); the fallback
  // status is never rendered since those returns don't show it.
  const statusUi = useAdvertiserShareStatusDisplay(share?.status ?? "PROCESSING");

  const load = useCallback(
    async ({ silent = true }: { silent?: boolean } = {}) => {
      const res = await callAuthed(
        router,
        (jwt) => getShareByUid({ jwt, params: { uid } }),
        { suppressAlerts: silent },
      );
      if (res.ok && res.data) setShare(res.data.share);
      setLoading(false);
    },
    [router, uid],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: false });
    setRefreshing(false);
  }, [load]);

  if (loading && !share) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      </View>
    );
  }

  if (!share) {
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
          <Text
            style={[
              text.body,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            {t("notFound")}
          </Text>
        </View>
      </View>
    );
  }

  const businessName = share.local?.name ?? t("thisBusiness");

  const isPaid = share.status === "PAID";
  const isFailed =
    share.status === "REJECTED" || share.status === "UNPAYABLE";
  const isReported = share.report != null;
  const reportStatus = share.report?.status ?? null;

  // Only a payout failure (UNPAYABLE) gets a reason line on the status card — a
  // REJECTED share is always report-upheld here, and the Report section covers it.
  // Deliberately coarse (Matej, 2026-08-02): the advertiser only cares whether
  // the story's stats were collectable — INSIGHTS_UNAVAILABLE gets its line,
  // every other slug (disconnect / data deletion / account deletion / settle
  // failure / pre-column null) is irrelevant detail to them and collapses to
  // the generic line. Both variants say they won't pay for it.
  const failureReason =
    share.status === "UNPAYABLE"
      ? share.voidReason === "INSIGHTS_UNAVAILABLE"
        ? t("statusUnpayableDescInsightsUnavailable")
        : t("statusUnpayableDesc")
      : null;

  // Whether the advertiser should assess this share now — the server's single
  // source of truth (approved + never assessed + the customer still exists), the
  // SAME rule the "shares to rate" queue filters on. Gating on this (not a local
  // `rating == null && report == null`) is what keeps an UN-assessable share from
  // trapping the screen: a share whose customer was deleted is unrated but
  // `shouldAssessShare` is false, so the non-dismissable sheet never force-opens
  // for it (and its submit would 4050). Once dealt with, details are revealed.
  const needsAssessment = share.shouldAssessShare;

  const stages = buildLifecycleStages(
    share.status,
    share.insights != null,
  );

  // Hero size: cap height, derive width from the aspect ratio, never exceed the
  // content width.
  const availW = screenWidth - layout.screenPadding * 2;
  const ar = share.media.aspectRatio || 1;
  const heroW = Math.min(availW, HERO_MAX_HEIGHT * ar);
  const heroH = heroW / ar;

  const allMetrics = share.insights
    ? (
        [
          ["metricReach", share.insights.reach],
          ["metricViews", share.insights.views],
          ["metricReplies", share.insights.replies],
          ["metricProfileVisits", share.insights.profileVisits],
          ["metricFollows", share.insights.follows],
          ["metricShares", share.insights.shares],
          ["metricInteractions", share.insights.totalInteractions],
        ] as const
      ).filter(([, v]) => v != null)
    : [];

  const reachVal = share.insights?.reach ?? null;
  const viewsVal = share.insights?.views ?? null;
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

  const interactionsVal = share.insights?.totalInteractions ?? null;
  const secondaryMetric: { key: MetricKey; value: number } | null =
    interactionsVal != null && mainMetric?.key !== "metricInteractions"
      ? { key: "metricInteractions", value: interactionsVal }
      : null;

  // Report copy varies with the outcome (pending / upheld / dismissed) AND
  // with whether the reward was already paid (E047): a report ruled after
  // settlement moves no money, so the paid variants drop the "you won't pay"
  // promise (the Spend card says "Paid" one scroll below) and state the real
  // consequence — the customer's rating takes the penalty.
  const reportShortKey =
    reportStatus === "VALID"
      ? isPaid
        ? "reportUpheldShortPaid"
        : "reportUpheldShort"
      : reportStatus === "DISMISSED"
        ? "reportDismissedShort"
        : "reportPendingShort";
  const reportInfoTitleKey =
    reportStatus === "VALID"
      ? "reportUpheldInfoTitle"
      : reportStatus === "DISMISSED"
        ? "reportDismissedInfoTitle"
        : "reportPendingInfoTitle";
  const reportInfoBodyKey =
    reportStatus === "VALID"
      ? isPaid
        ? "reportUpheldInfoBodyPaid"
        : "reportUpheldInfoBody"
      : reportStatus === "DISMISSED"
        ? "reportDismissedInfoBody"
        : isPaid
          ? "reportPendingInfoBodyPaid"
          : "reportPendingInfoBody";

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
          <CustomMedia
            media={share.media}
            thumbnail={share.thumbnail}
            renderVideo
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Text style={[text.bodyMedium, { color: statusUi.tone, flex: 1 }]}>
                {statusUi.label}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={color.text.tertiary}
              />
            </View>

            <StatusTimeline stages={stages} />

            {failureReason && (
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {failureReason}
              </Text>
            )}
          </Pressable>
        </Section>

        {/* ---- Report — cardless red flag chip + a short line; tap opens the
            "why" sheet. Shown when the advertiser reported the share. ---- */}
        {isReported && (
          <Section title={t("reportTitle")} text={text} color={color}>
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
              <View style={{ flex: 1, gap: spacing.xs / 2 }}>
                <Text style={[text.bodyMedium, { color: color.danger }]}>
                  {t(reportShortKey)}
                </Text>
                {share.report?.reportType && (
                  <Text
                    style={[text.caption, { color: color.text.secondary }]}
                  >
                    {tShares(`reason.${share.report.reportType}`)}
                  </Text>
                )}
              </View>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={color.danger}
              />
            </Pressable>
          </Section>
        )}

        {/* ---- Rating — the advertiser's own quality score, read-only ---- */}
        {share.rating != null && (
          <Section title={t("ratingTitle")} text={text} color={color}>
            <StarRating value={share.rating} readOnly size={30} />
          </Section>
        )}

        {/* ---- Spend — hidden for failed shares (there's no charge). The
            settle countdown is a sub-caption of the card, so it stays tighter
            to it (sm) than the section rhythm. ---- */}
        {!isFailed && (
          <Section title={t("spendTitle")} text={text} color={color}>
            <View style={{ gap: spacing.sm }}>
              <SpendCard share={share} paid={isPaid} />
              {share.status === "PROCESSING" && (
                <SpendTimer createdAt={share.createdAt} />
              )}
            </View>
          </Section>
        )}

        {/* ---- Insights — soft-blue metric chips (reach/views + interactions),
            "See all" opens the full table. Visible only post-rating (the gate). ---- */}
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
              <InsightStat metricKey={mainMetric.key} value={mainMetric.value} />
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
      </ScrollView>

      <LifecycleSheet
        open={lifecycleOpen}
        onClose={() => setLifecycleOpen(false)}
        stages={stages}
      />

      {/* Report explainer. */}
      <BottomSheet open={reportInfoOpen} onClose={() => setReportInfoOpen(false)}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t(reportInfoTitleKey)}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t(reportInfoBodyKey)}
          </Text>
        </View>
      </BottomSheet>

      {/* All insights — the full metric table. */}
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

      {/* Gated assessment — opens only for an unassessed share; non-dismissable,
          the back button pops the screen. Once assessed it closes and the details
          (incl. insights) are revealed. */}
      <ShareAssessmentSheet
        open={needsAssessment}
        share={share}
        onClose={() => {}}
        onBack={() => router.back()}
        onAssessed={(updated) =>
          setShare((prev) => (prev ? { ...prev, ...updated } : prev))
        }
        // 4093 (assessed elsewhere): refetch so shouldAssessShare flips and the
        // gated sheet releases — otherwise it reopens on stale state forever.
        onConflict={() => void load()}
      />
    </View>
  );
}

/** Titled section block — mirrors the customer detail's `Section`, with an
 *  optional `right` control aligned to the heading. Heading → content is
 *  `spacing.md`: enough air for the heading to read as a group label over its
 *  block (12 within a section vs 24 between sections keeps the rhythm legible). */
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
    <View style={{ marginHorizontal: spacingTokens.lg, gap: spacingTokens.md }}>
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

/** One cardless headline insight — a soft-blue accent chip (icon by metric) plus
 *  the big count over its label. */
function InsightStat({
  metricKey,
  value,
}: {
  metricKey: MetricKey;
  value: number;
}) {
  const { t } = useTranslation("shareDetail");
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
// Spend card — twin of the customer Reward card: an icon medallion, the eyebrow +
// amount, and a clarity sub-line (a paid spend shows when it settled). Tapping it
// opens the shared RewardInfoSheet in its advertiser (price) voice — the same
// six factors the customer sees, worded for the payer.
// ---------------------------------------------------------------------------

function SpendCard({
  share,
  paid,
}: {
  share: AdvertiserShareDetails;
  paid: boolean;
}) {
  const { t } = useTranslation("shareDetail");
  const { theme } = useTheme();
  const { color, text, radius, shadow, layout, spacing } = theme;
  const formatBudget = useFormatBudget();
  const [infoOpen, setInfoOpen] = useState(false);

  const cents = paid
    ? (share.finalPriceCents ?? share.estimatedPriceCents)
    : share.estimatedPriceCents;

  // Sub-line: a paid spend shows when it settled; an estimate ties to the reach
  // it was measured over once insights are in.
  const reach = share.insights?.reach ?? null;
  const sub = paid
    ? t("paidOn", { date: fmtDate(share.paidAt ?? share.createdAt) })
    : reach != null && reach > 0
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
            {paid ? t("spendPaidEyebrow") : t("spendEstimateEyebrow")}
          </Text>
          <Text style={[text.amountLg, { color: color.success }]}>
            {formatBudget(cents)}
          </Text>
          {sub && (
            <Text
              style={[
                text.caption,
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

      <RewardInfoSheet
        variant="advertiser"
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Spend timer — a quiet "charged in Xh Ym" label under the spend card while a
// share is still processing (settles at createdAt + 24h).
// ---------------------------------------------------------------------------

function SpendTimer({ createdAt }: { createdAt: string }) {
  const { t } = useTranslation("shareDetail");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const msLeft = useTimeRemaining(
    new Date(createdAt).getTime() + SETTLE_WINDOW_MS,
  );

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
        {msLeft > 0 ? t("chargeCountdown", { time }) : t("chargeSoon")}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle steps — the path every share walks from the advertiser's side
// (shared → reviewed → measuring → reward paid), with the current step
// highlighted and any failure marked. A reported share inserts a "report review"
// step. Kept here (single-use).
// ---------------------------------------------------------------------------

type StageKey = "shared" | "measuring" | "reportReview" | "reward";
type StageState = "done" | "active" | "failed" | "upcoming";
type Stage = {
  key: StageKey;
  icon: keyof typeof Ionicons.glyphMap;
  state: StageState;
};

const STAGE_ICON: Record<StageKey, keyof typeof Ionicons.glyphMap> = {
  shared: "share-social",
  measuring: "stats-chart",
  reportReview: "flag",
  reward: "wallet",
};

/**
 * The ordered lifecycle steps + their states for an advertiser status: shared →
 * measuring (getting insights) → reward. We deliberately DON'T surface the admin
 * approval/review of the post — the business never sees that we vet their shares.
 * A reported share inserts a "report review" step (active while pending, failed
 * once the report is upheld → the share is dropped) — that's the advertiser's OWN
 * report, which they know about. A payout failure marks "reward" failed.
 */
function buildLifecycleStages(
  status: AdvertiserShareStatus,
  hasInsights: boolean,
): Stage[] {
  const s = (key: StageKey, state: StageState): Stage => ({
    key,
    icon: STAGE_ICON[key],
    state,
  });

  const withReportStep = (st: StageState): Stage[] =>
    hasInsights
      ? [
          s("shared", "done"),
          s("measuring", "done"),
          s("reportReview", st),
          s("reward", "upcoming"),
        ]
      : [
          s("shared", "done"),
          s("reportReview", st),
          s("measuring", "upcoming"),
          s("reward", "upcoming"),
        ];

  switch (status) {
    case "PAID":
      return [
        s("shared", "done"),
        s("measuring", "done"),
        s("reward", "done"),
      ];
    case "REPORT_REVIEW":
      return withReportStep("active");
    case "REJECTED":
      // Advertiser REJECTED is always a report upheld → report step failed.
      return withReportStep("failed");
    case "UNPAYABLE":
      return [
        s("shared", "done"),
        s("measuring", "done"),
        s("reward", "failed"),
      ];
    default: // PROCESSING
      return [
        s("shared", "done"),
        s("measuring", "active"),
        s("reward", "upcoming"),
      ];
  }
}

type ThemeColor = ReturnType<typeof useTheme>["theme"]["color"];

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

function connectorColorFor(state: StageState, color: ThemeColor): string {
  return state === "done" ? color.on.brand : color.border.strong;
}

/** Compact horizontal progress timeline for the status card. */
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
  const { t } = useTranslation("shareDetail");
  const { theme } = useTheme();
  const { color, text, radius, spacing } = theme;

  const titleColor = (state: StageState) =>
    state === "failed"
      ? color.danger
      : state === "upcoming"
        ? color.text.tertiary
        : color.text.primary;

  const descFor = (key: StageKey, state: StageState): string => {
    if (state === "failed" && key === "reward") return t("lcRewardFailedDesc");
    if (state === "failed" && key === "reportReview")
      return t("lcReportFailedDesc");
    if (key === "reportReview") return t("lc_reportReview_desc");
    if (key === "shared") return t("lc_shared_desc");
    if (key === "measuring") return t("lc_measuring_desc");
    return t("lc_reward_desc");
  };

  const titleFor = (key: StageKey): string => {
    if (key === "reportReview") return t("lc_reportReview_title");
    if (key === "shared") return t("lc_shared_title");
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
                opacity: state === "upcoming" ? 0.55 : 1,
              }}
            >
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
