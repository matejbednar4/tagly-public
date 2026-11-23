import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme, useFormatBudget, withAlpha } from "@tagly/client";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { AdvertiserSharePreview } from "@tagly/models/v2/advertiserApp";
import { StarRating } from "@tagly/client";
import { useAdvertiserShareStatusDisplay } from "@/components/shares/shared/useShareStatusDisplay";

/**
 * SharePreviewCard — one of the advertiser's shares as a media-filling card
 * (the advertiser twin of the customer `SharePreviewCard`): the share fills the
 * card at its real aspect ratio, a status pill sits top-right, and a
 * slightly-translucent info bar overlays the bottom with what the advertiser
 * cares about — the business, the spend (final once PAID in green, an estimate
 * while in flight, nothing when REJECTED / UNPAYABLE since they won't pay),
 * and the assessment state (their stars, or a "tap to rate" hint).
 *
 * Copy comes from the feature-level `shares` namespace (`components/shares/
 * shared/`) — the status pill via `useAdvertiserShareStatusDisplay` — so this
 * card and the detail screen always use the same words.
 *
 * Deliberately no insights, per the rating philosophy (see
 * `ShareAssessmentSheet`). The parent supplies `onPress` (rate sheet from the
 * home strips, detail elsewhere) and the `width`; a video shows a centered
 * play glyph over its paused poster.
 */

// 9:16 ≈ 0.5625. Clamp so a stray value can't make a card absurdly tall/wide.
const clampAspectRatio = (ar: number) => Math.min(Math.max(ar, 0.5), 1.5);

export function SharePreviewCard({
  share,
  width,
  onPress,
}: {
  share: AdvertiserSharePreview;
  width: number;
  onPress: () => void;
}) {
  const { t } = useTranslation("shares");
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;
  const formatBudget = useFormatBudget();
  const status = useAdvertiserShareStatusDisplay(share.status);

  const mediaHeight = Math.round(
    width / clampAspectRatio(share.media.aspectRatio),
  );
  const isVideo = share.media.type === "VIDEO";

  const isPaid = share.status === "PAID" && share.finalPriceCents != null;
  const failed = share.status === "REJECTED" || share.status === "UNPAYABLE";

  // Spend line: the final debit once PAID (green); an estimate while in flight —
  // but ONLY once the advertiser has rated. Showing a reward figure next to an
  // unrated share would bias the quality rating (rate philosophy: the assessment
  // never surfaces price/insights). Nothing for failed shares (the pill says it).
  const paidAmount = isPaid ? formatBudget(share.finalPriceCents!) : null;
  const estimateText =
    !isPaid && !failed && share.rating != null
      ? t("estPrice", { amount: formatBudget(share.estimatedPriceCents) })
      : null;

  return (
    // Card chrome on a plain View; the tap is owned by CustomMedia's touchable
    // (an outer Pressable wouldn't fire — CustomMedia's TouchableOpacity
    // swallows the press). Long-press opens the media fullscreen.
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
        onPress={onPress}
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
          <Ionicons name={status.icon} size={12} color={status.tone} />
          <Text style={[text.micro, { color: status.tone }]} numberOfLines={1}>
            {status.label}
          </Text>
        </View>

        {/* Info bar overlaid on the media, slightly translucent: business name,
            the spend line, and the assessment state below. */}
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
          {/* The business name, or a muted fallback once the page is deleted
              (Share.localId is nulled on hard delete, so `local` goes null). */}
          <Text
            style={[
              text.label,
              {
                color: share.local?.name
                  ? color.text.primary
                  : color.text.tertiary,
              },
            ]}
            numberOfLines={1}
          >
            {share.local?.name ?? t("deletedBusiness")}
          </Text>

          {paidAmount ? (
            <Text
              style={[text.amountSm, { color: color.success }]}
              numberOfLines={1}
            >
              {paidAmount}
            </Text>
          ) : estimateText ? (
            <Text
              style={[
                text.caption,
                {
                  color: color.text.secondary,
                  // Match the paid amount's tight line box so the spend row is
                  // the same height either way (caption's 1.4 line-height is
                  // taller than amountSm's, which bloated the bar on estimates).
                  lineHeight: text.amountSm.lineHeight,
                },
              ]}
              numberOfLines={1}
            >
              {estimateText}
            </Text>
          ) : null}

          {/* Assessment: their stars once rated; a flagged "reported" tag once
              reported; an "unrated" tag otherwise. The preview never invites the
              tap — rating is done from its own button / the detail screen. */}
          {share.rating != null ? (
            <StarRating value={share.rating} readOnly size={13} />
          ) : share.report ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons name="flag" size={12} color={color.danger} />
              <Text
                style={[text.caption, { color: color.danger }]}
                numberOfLines={1}
              >
                {t("reported")}
              </Text>
            </View>
          ) : (
            <Text
              style={[text.caption, { color: color.text.tertiary }]}
              numberOfLines={1}
            >
              {t("unrated")}
            </Text>
          )}
        </View>
      </CustomMedia>
    </View>
  );
}
