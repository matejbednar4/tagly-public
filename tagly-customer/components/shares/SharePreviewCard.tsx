import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useFormatBudget, useTheme, withAlpha } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { CustomerSharePreview } from "@tagly/models/v2/customerApp";

/**
 * SharePreviewCard — the customer's own share: the media filling the card at its
 * real aspect ratio (optimized for the 9:16 stories that are ~all shares). A
 * status pill sits top-right, and a slightly-translucent info bar overlays the
 * bottom (like `BusinessPreview`): the business name with the reward below it. A
 * centered play button overlays a video (the card shows a paused poster).
 *
 * Reward line: the final payout once PAID (green); while in flight it's an
 * "est. X for Y reach" estimate (locale-aware "est."/"cca"). Failed shares
 * (Rejected / Failed) earn nothing, so no reward line shows — the pill says it.
 *
 * Owns its own navigation: tapping always opens the share detail (`/shares/:uid`).
 */

// 9:16 ≈ 0.5625. Clamp so a stray value can't make a card absurdly tall/wide.
const clampAspectRatio = (ar: number) => Math.min(Math.max(ar, 0.5), 1.5);

function useShareDisplay(share: CustomerSharePreview) {
  const { t } = useTranslation("shareCard");
  const { theme } = useTheme();
  const { color } = theme;
  const formatBudget = useFormatBudget();

  const isPaid = share.status === "PAID" && share.finalRewardCents != null;
  const failed = share.status === "REJECTED" || share.status === "UNPAYABLE";

  const status: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: string;
  } = (() => {
    switch (share.status) {
      case "PAID":
        return {
          label: t("statusPaid"),
          icon: "checkmark-circle",
          tone: color.success,
        };
      case "REJECTED":
        return {
          label: t("statusRejected"),
          icon: "close-circle",
          tone: color.danger,
        };
      case "UNPAYABLE":
        return {
          label: t("statusUnpayable"),
          icon: "close-circle",
          tone: color.text.tertiary,
        };
      // Intake hold (approvalStatus PENDING) — a calm "Under review" pill, distinct
      // from a plain in-flight share.
      case "UNDER_REVIEW":
        return {
          label: t("statusUnderReview"),
          icon: "hourglass-outline",
          tone: color.on.brand,
        };
      // A business reported this share and the payout is held while we review it
      // (REPORT_REVIEW). Its own "Reported" pill with a flag — matching the detail
      // screen — so the report reads at a glance; stays calm amber since it may
      // still be paid (the reward line keeps showing the estimate below).
      case "REPORT_REVIEW":
        return {
          label: t("statusReported"),
          icon: "flag",
          tone: color.on.brand,
        };
      // In flight (PROCESSING) → approved, not settled yet; the reward shown is
      // the estimate (+ its reach).
      default:
        return {
          label: t("statusPending"),
          icon: "time-outline",
          tone: color.text.secondary,
        };
    }
  })();

  // Reward line under the name: the final payout once PAID; otherwise an
  // "est. X for Y reach" line (locale-aware amount). Failed shares earn nothing,
  // so neither shows — the status pill says it all.
  const paidAmount = isPaid ? formatBudget(share.finalRewardCents!) : null;

  let estimateText: string | null = null;
  if (!isPaid && !failed) {
    const amount = formatBudget(share.estimatedRewardCents);
    estimateText =
      share.estimatedAverageReach != null
        ? t("estReward", {
            amount,
            reach: share.estimatedAverageReach.toLocaleString(),
          })
        : t("estRewardNoReach", { amount });
  }

  return {
    status,
    // Once the business page is hard-deleted, `local` goes null (Share.localId
    // is set null) — fall back to a muted "Deleted page" label.
    businessName: share.local?.name ?? t("deletedBusiness"),
    businessDeleted: !share.local?.name,
    paidAmount,
    estimateText,
  };
}

export default function SharePreviewCard({
  share,
  width,
}: {
  share: CustomerSharePreview;
  width: number;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;
  const router = useRouter();
  const d = useShareDisplay(share);
  const mediaHeight = Math.round(
    width / clampAspectRatio(share.media.aspectRatio),
  );
  const isVideo = share.media.type === "VIDEO";

  return (
    // Card chrome on a plain View; the tap is owned by CustomMedia's touchable
    // (an outer Pressable wouldn't fire — CustomMedia's TouchableOpacity swallows
    // the press), so routing goes through its onPress. Long-press opens the media
    // fullscreen (CustomMedia's built-in preview — not disabled here).
    <View
      style={{
        width,
        height: mediaHeight,
        borderRadius: radius.structure,
        backgroundColor: color.surface,
        boxShadow: shadow.card,
        overflow: "hidden",
      }}
    >
      <CustomMedia
        media={share.media}
        thumbnail={share.thumbnail}
        backgroundColor={color.surface}
        style={{ flex: 1 }}
        onPress={() =>
          router.push({ pathname: "/shares/[uid]", params: { uid: share.uid } })
        }
      >
        {/* Video → a centered play button, since the card shows a paused poster. */}
        {isVideo ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(color.ink, 0.95),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="play"
                size={22}
                color={color.surface}
                style={{ marginLeft: 2 }}
              />
            </View>
          </View>
        ) : null}

        {/* Status pill, top-right — a white chip so it reads over any photo. */}
        <View
          style={{
            position: "absolute",
            top: spacing.sm,
            right: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingVertical: 3,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: withAlpha(color.surface, 0.95),
            boxShadow: shadow.chip,
          }}
        >
          <Ionicons name={d.status.icon} size={12} color={d.status.tone} />
          <Text
            style={[text.micro, { color: d.status.tone }]}
            numberOfLines={1}
          >
            {d.status.label}
          </Text>
        </View>

        {/* Info bar overlaid on the media, slightly translucent (like the
            business preview): business name, then the reward / estimate below. */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.sm,
            gap: 2,
            backgroundColor: withAlpha(color.surface, 0.95),
          }}
        >
          <Text
            style={[
              text.label,
              {
                color: d.businessDeleted
                  ? color.text.tertiary
                  : color.text.primary,
              },
            ]}
            numberOfLines={1}
          >
            {d.businessName}
          </Text>
          {d.paidAmount ? (
            <Text
              style={[text.amountSm, { color: color.success }]}
              numberOfLines={1}
            >
              {d.paidAmount}
            </Text>
          ) : d.estimateText ? (
            <Text
              style={[text.caption, { color: color.text.secondary }]}
              numberOfLines={1}
            >
              {d.estimateText}
            </Text>
          ) : null}
        </View>
      </CustomMedia>
    </View>
  );
}
