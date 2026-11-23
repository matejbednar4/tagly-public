import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import {
  pressFeedbackStyle,
  useFormatBudget,
  useTheme,
  withAlpha,
  withQualityCdnUrlFromKey,
} from "@tagly/client";
import type { CreditPurchaseStatus } from "@tagly/models/shared";
import type { AdvertiserTransaction } from "@tagly/models/v2/advertiserApp";

const CREDIT_ICON: Record<
  Extract<AdvertiserTransaction, { type: "credit" }>["source"],
  keyof typeof Ionicons.glyphMap
> = {
  // Filled glyphs (not -outline): the tinted badge is subtle, so a solid icon
  // is what actually reads at a glance.
  CREDIT_PURCHASE_REFUND: "arrow-undo",
  PROMOTIONAL_CREDIT: "sparkles",
  ADJUSTMENT: "swap-horizontal",
  REFERRAL_PAYOUT: "gift",
};

// Deposit statuses where the charge never landed (or was returned) — the
// amount never (or no longer) counts, so it renders struck out + muted.
const DEPOSIT_DEAD: CreditPurchaseStatus[] = ["FAILED", "CANCELED", "REFUNDED"];

/**
 * TransactionPreview — one expandable card in the advertiser's money history
 * (the advertiser twin of the customer's transaction card). Collapsed it reads
 * at a glance: a deposit = money onto the balance from the card (green +,
 * with a status pill while pending / when it failed or was refunded), a spend
 * = a settled share (− in ink, tap through to the share), a credit = refund /
 * promo / adjustment / referral payout (signed). Tapping opens a
 * plain-language explanation — and for a PAYG charge, its surcharge breakdown.
 */
export default function TransactionPreview({
  item,
}: {
  item: AdvertiserTransaction;
}) {
  const { t } = useTranslation("transactionPreview");
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow, layout } = theme;
  const formatBudget = useFormatBudget();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Fade the business banner in over the icon once it loads.
  const imageOpacity = useRef(new Animated.Value(0)).current;

  // Drive the open animation (icon pop + chevron flip), matching the customer
  // transaction card so both feeds feel identical.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);
  const circleScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  // Grow the expanded panel open (height 0 → measured) instead of popping it in.
  const expand = useRef(new Animated.Value(0)).current;
  const [panelHeight, setPanelHeight] = useState(0);
  useEffect(() => {
    Animated.timing(expand, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [open, expand]);
  const panelAnimatedHeight = expand.interpolate({
    inputRange: [0, 1],
    outputRange: [0, panelHeight],
  });
  const panelOpacity = expand.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const isCs = dayjs.locale() === "cs";
  const dateLabel = dayjs(item.createdAt).format(
    isCs ? "D. M. YYYY" : "MMM D, YYYY",
  );
  const dateTimeLabel = dayjs(item.createdAt).format(
    isCs ? "D. M. YYYY [v] HH:mm" : "MMM D, YYYY [at] h:mm A",
  );

  const isDeposit = item.type === "deposit";
  const isSpend = item.type === "spend";
  const depositDead = isDeposit && DEPOSIT_DEAD.includes(item.status);
  const depositPending = isDeposit && item.status === "PENDING";
  const shareUid = isSpend ? item.shareUid : null;

  // ── Icon + chip ────────────────────────────────────────────────────────────
  // Money in reads green, money out reads in ink. A deposit's badge wears its
  // status pill colors while it isn't simply completed.
  const moneyIn = isDeposit || (item.type === "credit" && item.amountCents > 0);
  const icon: keyof typeof Ionicons.glyphMap = isDeposit
    ? "card"
    : isSpend
      ? "camera"
      : CREDIT_ICON[item.source];
  const statePill = isDeposit ? depositStatePill(item.status) : null;
  const chipTone = moneyIn && !depositDead ? color.success : color.ink;
  const chipBg = statePill ? statePill.bg : withAlpha(chipTone, 0.12);
  const chipFg = statePill ? statePill.fg : chipTone;

  // A spend row shows the business's banner (when it has one) over the icon —
  // same treatment as the customer feed's share-reward rows.
  const bannerUrl =
    isSpend && item.businessBanner
      ? withQualityCdnUrlFromKey(item.businessBanner.key, { quality: 80 })
      : null;

  // ── Title ──────────────────────────────────────────────────────────────────
  const title = isDeposit
    ? item.kind === "PAYG_CHARGE"
      ? t("paygCharge")
      : t("creditPurchase")
    : isSpend
      ? item.businessName
        ? t("spendAt", { business: item.businessName })
        : t("spend")
      : t(
          (
            {
              CREDIT_PURCHASE_REFUND: "refund",
              PROMOTIONAL_CREDIT: "promoCredit",
              ADJUSTMENT: "adjustment",
              REFERRAL_PAYOUT: "referralBonus",
            } as const
          )[item.source],
        );

  const subtitle = open ? dateTimeLabel : dateLabel;

  // What this event means (status-specific for a deposit).
  const explanation = isDeposit
    ? depositExplanation(item.status, item.kind === "PAYG_CHARGE")
    : isSpend
      ? t("explainSpend")
      : t(
          (
            {
              CREDIT_PURCHASE_REFUND: "explainRefund",
              PROMOTIONAL_CREDIT: "explainPromo",
              ADJUSTMENT: "explainAdjustment",
              REFERRAL_PAYOUT: "explainReferral",
            } as const
          )[item.source],
        );

  // ── Amount ─────────────────────────────────────────────────────────────────
  // Deposits/credits in are green +; spend and negative credits are neutral ink
  // − (red stays reserved for the FAILED pill). A dead deposit is struck out.
  // A PENDING deposit shows the bare amount, muted — no sign, since nothing has
  // been added yet ("+" would claim money that hasn't landed).
  const negative = isSpend || item.amountCents < 0;
  const amountColor =
    depositDead || depositPending
      ? color.text.tertiary
      : moneyIn
        ? color.success
        : color.text.primary;
  const absCents = Math.abs(item.amountCents);
  const sign = negative ? "−" : depositPending ? "" : "+";
  const amountUsd = `${sign}${formatBudget(absCents, { forcedCurrency: "USD" })}`;
  const amountCzk = formatBudget(absCents, { asCzkSecondaryLine: true });

  // Each deposit status owns a semantic color pairing (same scheme as the
  // customer's withdrawal pills): PENDING = accent (in motion), FAILED =
  // danger, CANCELED/REFUNDED = ink (nothing moved / returned). COMPLETED
  // needs no pill — the green + already says it.
  function depositStatePill(status: CreditPurchaseStatus): {
    label: string;
    bg: string;
    fg: string;
  } | null {
    switch (status) {
      case "PENDING":
        return {
          label: t("statePending"),
          bg: withAlpha(color.accent, 0.5),
          fg: color.on.accent,
        };
      case "FAILED":
        return {
          label: t("stateFailed"),
          bg: withAlpha(color.danger, 0.14),
          fg: color.danger,
        };
      case "CANCELED":
        return {
          label: t("stateCanceled"),
          bg: withAlpha(color.ink, 0.1),
          fg: color.ink,
        };
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return {
          label: t("stateRefunded"),
          bg: withAlpha(color.ink, 0.1),
          fg: color.ink,
        };
      default:
        return null;
    }
  }

  function depositExplanation(
    status: CreditPurchaseStatus,
    isPayg: boolean,
  ): string {
    if (status === "PENDING") return t("explainPending");
    // A failed PAYG charge is retried by the SYSTEM (backend backoff) and the
    // user's fix is the card — never invite them to "try again" themselves.
    if (status === "FAILED")
      return isPayg ? t("explainPaygFailed") : t("explainFailed");
    if (status === "CANCELED") return t("explainCanceled");
    if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED")
      return t("explainRefunded");
    return isPayg ? t("explainPaygCharge") : t("explainPurchase");
  }

  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        boxShadow: shadow.card,
        paddingHorizontal: layout.cardPadding,
      }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        <Animated.View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.structure,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: chipBg,
            transform: [{ scale: circleScale }],
          }}
        >
          {/* Icon sits underneath; the banner (if any) layers over it and falls
              back to the icon if the image fails to load. */}
          <Ionicons name={icon} size={20} color={chipFg} />
          {bannerUrl ? (
            <Animated.Image
              source={{ uri: bannerUrl }}
              onLoad={() =>
                Animated.timing(imageOpacity, {
                  toValue: 1,
                  duration: 250,
                  useNativeDriver: true,
                }).start()
              }
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: imageOpacity,
              }}
              resizeMode="cover"
            />
          ) : null}
        </Animated.View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[text.bodyMedium, { color: color.text.primary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {/* Metadata line: the status pill leads (when there is one), the date
              follows — the pill inline with the title crowded long headings. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {statePill ? (
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: statePill.bg,
                }}
              >
                <Text style={[text.micro, { color: statePill.fg }]}>
                  {statePill.label}
                </Text>
              </View>
            ) : null}
            {/* The date always stays one line — the full open-state timestamp
                shrinks to fit next to the pill instead of wrapping. */}
            <Text
              style={[
                text.caption,
                { color: color.text.secondary, flexShrink: 1 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text
            style={[
              text.amountSm,
              {
                color: amountColor,
                textDecorationLine: depositDead ? "line-through" : "none",
              },
            ]}
            numberOfLines={1}
          >
            {amountUsd}
          </Text>
          {amountCzk ? (
            <Text
              style={[text.micro, { color: color.text.tertiary }]}
              numberOfLines={1}
            >
              {amountCzk}
            </Text>
          ) : null}
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={16} color={color.text.tertiary} />
        </Animated.View>
      </Pressable>

      {/* Expanded: what this event means, the exact time, the PAYG surcharge
          breakdown, and a link to the share for a settled spend. */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={{
          overflow: "hidden",
          opacity: panelOpacity,
          height: panelHeight ? panelAnimatedHeight : undefined,
        }}
      >
        <View
          onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            gap: spacing.sm,
            paddingBottom: spacing.md,
            paddingLeft: 40 + spacing.md, // align under the title, past the chip
          }}
        >
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {explanation}
          </Text>
          {isDeposit &&
          item.kind === "PAYG_CHARGE" &&
          item.paygSurchargeCents != null &&
          item.paygSurchargeCents > 0 ? (
            <Text style={[text.caption, { color: color.text.tertiary }]}>
              {t("surcharge", {
                amount: formatBudget(item.paygSurchargeCents, {
                  forcedCurrency: "USD",
                }),
              })}
            </Text>
          ) : null}
          {shareUid ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/shares/[uid]",
                  params: { uid: shareUid },
                })
              }
              hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
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
                  gap: spacing.xs,
                  alignSelf: "flex-start",
                  backgroundColor: color.ink,
                  borderRadius: radius.pill,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.xs,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              <Text style={[text.label, { color: color.on.ink }]}>
                {t("viewShare")}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={color.on.ink} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
