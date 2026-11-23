import { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme, callAuthed, useCatalogLocalizer } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import { adminGetShareByUid } from "@tagly/sdk/v2/adminApp";
import type { AdminShare } from "@tagly/models/v2/adminApp";
import type { ShareUid } from "@tagly/models/shared";
import { StatSection, StatTile } from "@/components/statistics/StatKit";
import {
  DetailScaffold,
  InfoRows,
  LedgerEventsList,
  orDash,
  yesNo,
  formatBpsMultiplier,
  type InfoRow,
} from "@/components/details/DetailKit";
import { Badge, BadgeRow } from "@/components/entities/EntityRows";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";
import {
  openUrl,
  instagramProfileUrl,
  stripeDashboardUrl,
} from "@/utils/links";

/** Insight metrics in display order — null values are skipped. */
const INSIGHT_FIELDS: { key: string; label: string }[] = [
  { key: "reach", label: "Reach" },
  { key: "views", label: "Views" },
  { key: "shares", label: "Shares" },
  { key: "totalInteractions", label: "Total interactions" },
  { key: "follows", label: "Follows" },
  { key: "profileVisits", label: "Profile visits" },
  { key: "comments", label: "Comments" },
  { key: "likes", label: "Likes" },
  { key: "saved", label: "Saved" },
  { key: "replies", label: "Replies" },
  { key: "tapsForward", label: "Taps forward" },
  { key: "tapsBack", label: "Taps back" },
  { key: "exits", label: "Exits" },
  { key: "igReelsAvgWatchTime", label: "Avg watch time (s)" },
];

/**
 * Share detail — `GET /v2/admin/shares/:uid`, the full `AdminShare` DTO in
 * collapsible sections: the three status views + DB ground truth, the report,
 * media/IG info, pricing (estimate → final → the full `FinalPrice` audit row),
 * rating, insights, lifecycle/debug bookkeeping, the ledger trail, and links to
 * the related business / customer / advertiser. Reached from any share preview.
 */
export default function AdminShareDetailScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { typeName } = useCatalogLocalizer();

  const [share, setShare] = useState<AdminShare | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShare = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) => adminGetShareByUid({ jwt, params: { uid: uid as ShareUid } }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setShare(res.data.share);
    setLoading(false);
  }, [router, uid]);

  useEffect(() => {
    void fetchShare();
  }, [fetchShare]);

  const s = share;
  const fp = s?.finalPrice ?? null;
  const media = s ? (s.thumbnail ?? s.media) : null;

  return (
    <DetailScaffold
      title={s?.local?.name ?? "Share"}
      loading={loading}
      found={s != null}
    >
      {s && media ? (
        <>
          {/* Header — media + business/customer + headline badges */}
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <CustomMedia
              media={media}
              style={{
                width: 96,
                aspectRatio: media.aspectRatio,
                borderRadius: radius.structure,
              }}
              backgroundColor={color.brand}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text
                style={[text.title, { color: color.ink }]}
                numberOfLines={2}
              >
                {s.local?.name ?? "Deleted business"}
              </Text>
              <Text
                style={[text.caption, { color: color.text.secondary }]}
                numberOfLines={1}
              >
                {s.customer?.fullName ?? "Deleted customer"}
              </Text>
              <Text style={[text.micro, { color: color.text.tertiary }]}>
                {formatDateTime(s.createdAt)}
              </Text>
            </View>
          </View>
          <BadgeRow>
            <Badge tone="info" label={`C: ${s.customerStatus}`} />
            {s.visibleToAdvertiser ? (
              <Badge tone="info" label={`A: ${s.advertiserStatus}`} />
            ) : (
              <Badge tone="ink" label="A: hidden" />
            )}
            <Badge tone="highlight" label={s.fundingModeAtCreation} />
            <Badge
              tone="money"
              label={formatUsd(s.finalRewardCents ?? s.estimatedRewardCents)}
            />
          </BadgeRow>

          <StatSection
            title="Status"
            icon="flag-outline"
            tint="accent"
            defaultOpen
          >
            <InfoRows
              rows={[
                { label: "UID", value: s.uid },
                { label: "Customer sees", value: s.customerStatus },
                {
                  label: "Advertiser sees",
                  value: s.visibleToAdvertiser
                    ? s.advertiserStatus
                    : "Nothing (not approved)",
                },
                { label: "Raw status", value: s.rawStatus },
                {
                  label: "Approval",
                  value: s.approvalStatus,
                  tone: s.approvalStatus === "REJECTED" ? "danger" : "default",
                },
                {
                  label: "Reviewed",
                  value: s.reviewedAt
                    ? formatDateTime(s.reviewedAt)
                    : "Not yet",
                },
                {
                  label: "Reviewed by admin",
                  value: orDash(s.reviewedByAdminId),
                },
                ...(s.rejectionReason
                  ? [
                      {
                        label: "Rejection reason",
                        value: s.rejectionReason,
                        tone: "danger" as const,
                      },
                    ]
                  : []),
                { label: "Funding mode", value: s.fundingModeAtCreation },
                { label: "Force created", value: yesNo(s.forceCreated) },
              ]}
            />
          </StatSection>

          {s.report ? (
            <StatSection
              title="Report"
              icon="alert-circle-outline"
              tint="brand"
              summary={s.report.status}
              defaultOpen={s.report.status === "PENDING"}
            >
              <InfoRows
                rows={[
                  { label: "Type", value: s.report.reportType },
                  { label: "Message", value: orDash(s.report.reportMessage) },
                  {
                    label: "Status",
                    value: s.report.status,
                    tone:
                      s.report.status === "PENDING"
                        ? "danger"
                        : s.report.status === "VALID"
                          ? "danger"
                          : "default",
                  },
                  {
                    label: "Review message",
                    value: orDash(s.report.reviewMessage),
                  },
                  {
                    label: "Reviewed by admin",
                    value: orDash(s.report.reviewedById),
                  },
                  {
                    label: "Reviewed",
                    value: s.report.reviewedAt
                      ? formatDateTime(s.report.reviewedAt)
                      : "Not yet",
                  },
                  { label: "Filed", value: formatDateTime(s.report.createdAt) },
                ]}
              />
            </StatSection>
          ) : null}

          <StatSection
            title="Instagram post"
            icon="logo-instagram"
            tint="accent"
            summary={s.igPostType ?? undefined}
          >
            <InfoRows
              rows={[
                { label: "Post type", value: orDash(s.igPostType) },
                { label: "Post ID", value: orDash(s.igPostId) },
                {
                  label: "Posted to IG",
                  value: s.postedToIgAt ? formatDateTime(s.postedToIgAt) : "—",
                },
                {
                  label: "Media aspect ratio",
                  value: s.media.aspectRatio.toFixed(2),
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Pricing"
            icon="cash-outline"
            tint="money"
            summary={formatUsd(s.finalPriceCents ?? s.estimatedPriceCents)}
            defaultOpen
          >
            <StatTile
              icon="pricetag-outline"
              chip="money"
              label={
                s.finalPriceCents != null ? "Final price" : "Estimated price"
              }
              value={formatUsd(s.finalPriceCents ?? s.estimatedPriceCents)}
              tone="money"
            />
            <StatTile
              icon="gift-outline"
              chip="money"
              label={
                s.finalRewardCents != null ? "Final reward" : "Estimated reward"
              }
              value={formatUsd(s.finalRewardCents ?? s.estimatedRewardCents)}
              tone="money"
            />
            <InfoRows
              rows={[
                {
                  label: "Estimated price",
                  value: formatUsd(s.estimatedPriceCents),
                  tone: "money",
                },
                {
                  label: "Estimated reward",
                  value: formatUsd(s.estimatedRewardCents),
                  tone: "money",
                },
                {
                  label: "Estimated avg reach",
                  value:
                    s.estimatedAverageReach != null
                      ? formatInt(s.estimatedAverageReach)
                      : "—",
                },
                {
                  label: "Final price",
                  value:
                    s.finalPriceCents != null
                      ? formatUsd(s.finalPriceCents)
                      : "Not settled",
                  tone: "money",
                },
                {
                  label: "Final reward",
                  value:
                    s.finalRewardCents != null
                      ? formatUsd(s.finalRewardCents)
                      : "Not settled",
                  tone: "money",
                },
                {
                  label: "Platform delta",
                  value:
                    s.totalPlatformDeltaCents != null
                      ? formatUsd(s.totalPlatformDeltaCents)
                      : "—",
                  tone: "money",
                },
              ]}
            />
            {fp ? (
              <InfoRows
                rows={[
                  { label: "Algo version", value: String(fp.algoVersion) },
                  { label: "Currency", value: fp.currency.toUpperCase() },
                  {
                    label: "Qualified reach",
                    value: formatInt(fp.qualifiedReach),
                  },
                  {
                    label: "ECPM",
                    value: formatUsd(fp.ecpmCents),
                    tone: "money",
                  },
                  {
                    label: "Base value",
                    value: formatUsd(fp.baseValueCents),
                    tone: "money",
                  },
                  {
                    label: "Action bonuses",
                    value: formatUsd(fp.actionBonusesCents),
                    tone: "money",
                  },
                  {
                    label: "Geo multiplier",
                    value: formatBpsMultiplier(fp.geoMultiplierBps),
                  },
                  {
                    label: "Demo multiplier",
                    value: formatBpsMultiplier(fp.demoMultiplierBps),
                  },
                  {
                    label: "Interest multiplier",
                    value: formatBpsMultiplier(fp.interestMultiplierBps),
                  },
                  {
                    label: "Type multiplier",
                    value: formatBpsMultiplier(fp.typeMultiplierBps),
                  },
                  {
                    label: "Rating multiplier",
                    value: formatBpsMultiplier(fp.ratingMultiplierBps),
                  },
                  {
                    label: "Frequency multiplier",
                    value: formatBpsMultiplier(fp.frequencyMultiplierBps),
                  },
                  {
                    label: "Audience relevance",
                    value: formatBpsMultiplier(
                      fp.audienceRelevanceMultiplierBps,
                    ),
                  },
                  {
                    label: "Account quality",
                    value: formatBpsMultiplier(fp.accountQualityMultiplierBps),
                  },
                  {
                    label: "Subtotal before cap",
                    value:
                      fp.subtotalBeforeCapCents != null
                        ? formatUsd(fp.subtotalBeforeCapCents)
                        : "—",
                    tone: "money",
                  },
                  {
                    label: "Subtotal after cap",
                    value:
                      fp.subtotalAfterCapCents != null
                        ? formatUsd(fp.subtotalAfterCapCents)
                        : "—",
                    tone: "money",
                  },
                  {
                    label: "Country multiplier",
                    value: formatBpsMultiplier(fp.countryMultiplierBps),
                  },
                  {
                    label: "Final price",
                    value: formatUsd(fp.finalPriceCents),
                    tone: "money",
                  },
                  {
                    label: "Settled gross",
                    value:
                      fp.settledGrossCents != null
                        ? formatUsd(fp.settledGrossCents)
                        : "—",
                    tone: "money",
                  },
                  {
                    label: "Cap reason",
                    value: orDash(fp.capReason),
                    tone: fp.capReason ? "danger" : "default",
                  },
                  { label: "Priced", value: formatDateTime(fp.createdAt) },
                  {
                    label: "Price updated",
                    value: formatDateTime(fp.updatedAt),
                  },
                ]}
              />
            ) : (
              <InfoRows
                rows={[
                  { label: "Final price audit", value: "Not settled yet" },
                ]}
              />
            )}
          </StatSection>

          <StatSection
            title="Rating"
            icon="star-outline"
            tint="brand"
            summary={s.ratingStars != null ? `${s.ratingStars}★` : "Unrated"}
          >
            <InfoRows
              rows={[
                {
                  label: "Stars",
                  value:
                    s.ratingStars != null
                      ? `${s.ratingStars / 2} out of 5`
                      : "Unrated",
                },
                {
                  label: "Rated",
                  value: s.ratedAt ? formatDateTime(s.ratedAt) : "Not yet",
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Insights"
            icon="bar-chart-outline"
            tint="accent"
            summary={
              s.insights?.reach != null
                ? formatInt(s.insights.reach)
                : undefined
            }
          >
            {s.insights ? (
              <InfoRows
                rows={[
                  { label: "Post type", value: s.insights.postType },
                  ...INSIGHT_FIELDS.flatMap((f): InfoRow[] => {
                    const v = (
                      s.insights as unknown as Record<string, number | null>
                    )[f.key];
                    return v != null
                      ? [{ label: f.label, value: formatInt(v) }]
                      : [];
                  }),
                ]}
              />
            ) : (
              <InfoRows
                rows={[{ label: "Insights", value: "Not collected yet" }]}
              />
            )}
          </StatSection>

          <StatSection
            title="Lifecycle"
            icon="time-outline"
            tint="brand"
            summary={s.paidAt ? "Paid" : s.rawStatus}
          >
            <InfoRows
              rows={[
                { label: "Created", value: formatDateTime(s.createdAt) },
                {
                  label: "Paid",
                  value: s.paidAt ? formatDateTime(s.paidAt) : "Not yet",
                },
                {
                  label: "Last processing error",
                  value: orDash(s.lastProcessingError),
                  tone: s.lastProcessingError ? "danger" : "default",
                },
                {
                  label: "Last error at",
                  value: s.lastProcessingErrorAt
                    ? formatDateTime(s.lastProcessingErrorAt)
                    : "—",
                },
                {
                  label: "PAYG charge attempts",
                  value: orDash(s.paygChargeAttempts),
                },
                {
                  label: "PAYG next retry",
                  value: s.paygNextRetryAt
                    ? formatDateTime(s.paygNextRetryAt)
                    : "—",
                },
                {
                  label: "Stripe payment intent",
                  value: orDash(s.stripePaymentIntentId),
                  ...(s.stripePaymentIntentId
                    ? {
                        link: "external" as const,
                        onPress: () =>
                          openUrl(
                            stripeDashboardUrl(
                              "payment_intent",
                              s.stripePaymentIntentId as string,
                            ),
                          ),
                      }
                    : null),
                },
              ]}
            />
          </StatSection>

          <StatSection
            title="Ledger"
            icon="receipt-outline"
            tint="money"
            summary={formatInt(s.ledgerEvents.length)}
          >
            <LedgerEventsList events={s.ledgerEvents} />
          </StatSection>

          <StatSection
            title="Related"
            icon="link-outline"
            tint="accent"
            defaultOpen
          >
            <InfoRows
              rows={[
                s.local
                  ? {
                      label: "Business",
                      value: `${s.local.name} · ${typeName(s.local.type.slug)} · ${s.local.city}`,
                      onPress: () => router.push(`/businesses/${s.local?.uid}`),
                    }
                  : { label: "Business", value: "Deleted" },
                ...(s.local?.instagramTag
                  ? [
                      {
                        label: "Business IG",
                        value: `@${s.local.instagramTag}`,
                        link: "external" as const,
                        onPress: () =>
                          openUrl(
                            instagramProfileUrl(
                              s.local?.instagramTag as string,
                            ),
                          ),
                      },
                    ]
                  : []),
                s.customer
                  ? {
                      label: "Customer",
                      value: `${s.customer.fullName}${s.customer.instagramUsername ? ` · @${s.customer.instagramUsername}` : ""}${s.customer.status === "BANNED" ? " · BANNED" : ""}`,
                      onPress: () =>
                        router.push(`/customers/${s.customer?.uid}`),
                    }
                  : { label: "Customer", value: "Deleted" },
                ...(s.customer
                  ? [
                      {
                        label: "Customer multiplier",
                        value: formatBpsMultiplier(s.customer.multiplierBps),
                      },
                    ]
                  : []),
                s.advertiserUid
                  ? {
                      label: "Advertiser",
                      value: s.advertiserUid,
                      onPress: () =>
                        router.push(`/advertisers/${s.advertiserUid}`),
                    }
                  : {
                      label: "Advertiser",
                      value: "None (subsidized / unowned)",
                    },
              ]}
            />
          </StatSection>
        </>
      ) : null}
    </DetailScaffold>
  );
}
