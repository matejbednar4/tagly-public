import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme, pressFeedbackStyle } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { AdminShare } from "@tagly/models/v2/adminApp";
import type { ReportType } from "@tagly/models/shared";
import { Badge, BadgeRow, statusTone } from "@/components/entities/EntityRows";
import { formatUsd, formatDateTime } from "@/utils/format";

/** English labels for the report reasons (admin is English-only). */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  NOT_PROMOTION: "Not a promotion",
  MISLEADING_LOCATION: "Misleading location",
  INAPPROPRIATE: "Inappropriate",
  DUPLICATE: "Duplicate",
  VIOLATES_GUIDELINES: "Violates guidelines",
  CUSTOMER_NOT_SPENT_MONEY: "Customer didn't spend money",
};

/**
 * One share in a Review queue. Unlike the browse `ShareRow`, the media keeps
 * CustomMedia's own tap (opens the fullscreen gallery — reviewing IS looking
 * at the post), the info column taps into the share detail screen, and the
 * queue screen renders its actions via `children` at the bottom of the card.
 * The report queue passes `showReport` to surface the report inline.
 */
export function QueueShareCard({
  share,
  onOpenDetail,
  showReport = false,
  children,
}: {
  share: AdminShare;
  onOpenDetail: () => void;
  showReport?: boolean;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const media = share.thumbnail ?? share.media;
  const reward = share.finalRewardCents ?? share.estimatedRewardCents;
  const report = share.report;

  return (
    // Outer carries the shadow (never clipped); inner clips the media to the
    // rounded corners.
    <View style={{ borderRadius: radius.structure, boxShadow: shadow.card }}>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          {/* Fullscreenable — CustomMedia's own tap opens the gallery. */}
          <CustomMedia
            media={media}
            style={{ alignSelf: "stretch", aspectRatio: media.aspectRatio }}
            backgroundColor={color.accent}
          />
          <Pressable
            onPress={onOpenDetail}
            style={({ pressed, hovered }) => [
              {
                flex: 1,
                padding: layout.cardPaddingCompact,
                gap: spacing.xs,
                justifyContent: "center",
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Text
              style={[text.bodyMedium, { color: color.ink }]}
              numberOfLines={1}
            >
              {share.local?.name ?? "Deleted business"}
            </Text>
            <Text
              style={[text.caption, { color: color.text.secondary }]}
              numberOfLines={1}
            >
              {share.customer?.fullName ?? "Deleted customer"}
            </Text>
            <Text
              style={[text.caption, { color: color.text.secondary }]}
              numberOfLines={1}
            >
              {formatDateTime(share.createdAt)}
            </Text>
            <BadgeRow>
              <Badge
                tone={statusTone(share.customerStatus)}
                label={`C: ${share.customerStatus}`}
              />
              <Badge tone="highlight" label={share.fundingModeAtCreation} />
              <Badge tone="money" label={formatUsd(reward)} />
            </BadgeRow>
          </Pressable>
        </View>

        {showReport && report ? (
          <View
            style={{
              backgroundColor: color.dangerBg,
              paddingHorizontal: layout.cardPaddingCompact,
              paddingVertical: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <Text style={[text.label, { color: color.on.dangerBg }]}>
              {REPORT_TYPE_LABELS[report.reportType]}
            </Text>
            {report.reportMessage ? (
              <Text style={[text.caption, { color: color.on.dangerBg }]}>
                {report.reportMessage}
              </Text>
            ) : null}
            <Text style={[text.micro, { color: color.on.dangerBg }]}>
              {`Reported ${formatDateTime(report.createdAt)}`}
            </Text>
          </View>
        ) : null}

        {children ? (
          <View
            style={{
              padding: layout.cardPaddingCompact,
              paddingTop: showReport && report ? layout.cardPaddingCompact : 0,
              gap: spacing.sm,
            }}
          >
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}
