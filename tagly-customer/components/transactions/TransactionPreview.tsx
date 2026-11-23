import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import dayjs from "dayjs";
import {
  callAuthed,
  pressFeedbackStyle,
  useFormatBudget,
  useTheme,
  withAlpha,
  withQualityCdnUrlFromKey,
} from "@tagly/client";
import { createExpressDashboardLink } from "@tagly/sdk/v2/customerApp";
import type { WithdrawalDisplayState } from "@tagly/models/shared";
import type { CustomerTransaction } from "@tagly/models/v2/customerApp";

const EARNING_ICON: Record<
  Extract<CustomerTransaction, { type: "earning" }>["source"],
  keyof typeof Ionicons.glyphMap
> = {
  // Filled glyphs (not -outline): the tinted badge is subtle, so a solid icon is
  // what actually reads at a glance instead of blending into the fill.
  SHARE_PAYMENT: "camera", // the Instagram post you were paid for
  REFERRAL_PAYOUT: "gift",
  ADJUSTMENT: "swap-horizontal",
};

// Withdrawal states where money actually left the balance (so the −amount is
// real). FAILED/REVERSED never moved (or were credited back) → struck out.
const MONEY_LEFT: WithdrawalDisplayState[] = [
  "PROCESSING",
  "DELAYED",
  "PAID_OUT",
];

/**
 * TransactionPreview — one expandable card in the customer's money history.
 * Collapsed it reads at a glance (earnings = green money in; a withdrawal = money
 * out to the bank, with a derived state pill, struck-out if it was returned);
 * tapping it opens a plain-language explanation of what the event means — and for
 * a withdrawal, where the money physically is right now + what happens next.
 *
 * Each withdrawal state carries its own semantic color so the pill alone tells
 * the story: PROCESSING = accent (in motion), DELAYED = brand/butter (needs
 * attention), PAID_OUT = success, FAILED = danger, REVERSED = ink (returned).
 * DELAYED additionally offers "Fix bank details" (opens the Stripe Express
 * dashboard) — fixing the bank there triggers an automatic payout retry on the
 * backend. A share reward offers "View share" instead. Opening springs the icon
 * circle and flips the chevron.
 */
export default function TransactionPreview({
  item,
}: {
  item: CustomerTransaction;
}) {
  const { t } = useTranslation("transactionPreview");
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow, layout } = theme;
  const formatBudget = useFormatBudget();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bankLinkLoading, setBankLinkLoading] = useState(false);

  // DELAYED action: open the Stripe Express dashboard where the customer can fix
  // their bank details — the backend picks the change up (external-account
  // webhook) and retries the payout automatically, so this link IS the fix.
  const openBankDetails = async () => {
    if (bankLinkLoading) return;
    setBankLinkLoading(true);
    const res = await callAuthed(router, (jwt) =>
      createExpressDashboardLink({ jwt }),
    );
    if (res.ok && res.data) {
      await WebBrowser.openBrowserAsync(res.data.url);
    }
    // callAuthed already surfaced any error (network / no JWT / domain error).
    setBankLinkLoading(false);
  };

  // Fade the banner in over the icon once it loads.
  const imageOpacity = useRef(new Animated.Value(0)).current;

  // Drive the open animation (icon circle pop + chevron flip).
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
  // Height/opacity can't run on the native driver, so this uses its own JS-driven
  // value alongside the native icon/chevron spring above; `panelHeight` is the
  // panel's natural height, measured once via onLayout on the absolute child.
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
  // Fade the content in over the second half of the grow (and out over the first
  // half on close) so text doesn't appear until there's room for it.
  const panelOpacity = expand.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Format in the app language (dayjs locale is synced to it). Czech joins date
  // and time with "v" ("1. července 2026 v 14:30"), English with "at"; Hermes'
  // Intl is unreliable for this, so we format explicitly.
  const isCs = dayjs.locale() === "cs";
  const dateLabel = dayjs(item.createdAt).format(
    isCs ? "D. M. YYYY" : "MMM D, YYYY",
  );
  // Full timestamp for the expanded panel — date + time, no seconds.
  const dateTimeLabel = dayjs(item.createdAt).format(
    isCs ? "D. M. YYYY [v] HH:mm" : "MMM D, YYYY [at] h:mm A",
  );
  const isWithdrawal = item.type === "withdrawal";
  const isShareReward = !isWithdrawal && item.source === "SHARE_PAYMENT";
  // A share reward links to its share (when we have the uid).
  const shareUid =
    item.type === "earning" && item.source === "SHARE_PAYMENT"
      ? item.shareUid
      : null;

  // ── Icon + chip ─────────────────────────────────────────────────────────────
  // Money in reads green, money out reads in ink — a real tone on the badge
  // instead of the muted grey that blended into the card.
  const moneyIn = !isWithdrawal && item.amountCents > 0;
  // Withdrawal that never left / was credited back → the arrow points back.
  const moneyReturned = isWithdrawal && !MONEY_LEFT.includes(item.state);
  const icon: keyof typeof Ionicons.glyphMap = isWithdrawal
    ? moneyReturned
      ? "arrow-undo" // the money came back to the balance
      : "arrow-up" // money out to the bank
    : EARNING_ICON[item.source];
  // A withdrawal's icon badge wears the same colors as its state pill, so the
  // state reads twice at a glance; earnings keep the green/ink tint.
  const statePill = isWithdrawal ? withdrawalStatePill(item.state) : null;
  const chipTone = moneyIn ? color.success : color.ink;
  const chipBg = statePill ? statePill.bg : withAlpha(chipTone, 0.12);
  const chipFg = statePill ? statePill.fg : chipTone;

  // A share reward shows the business's banner (when it has one) instead of the
  // icon — a small circular thumbnail.
  const bannerUrl =
    item.type === "earning" &&
    item.source === "SHARE_PAYMENT" &&
    item.businessBanner
      ? withQualityCdnUrlFromKey(item.businessBanner.key, {
          quality: 80,
        })
      : null;

  // ── Title ────────────────────────────────────────────────────────────────────
  const title = isWithdrawal
    ? t("withdrawal")
    : isShareReward
      ? item.businessName
        ? t("earnedFrom", { business: item.businessName })
        : t("earnedShare")
      : item.source === "REFERRAL_PAYOUT"
        ? t("referralBonus")
        : t("adjustment");

  // The subtitle is just the date; it grows to include the time when the card is
  // open (so there's no separate timestamp line in the panel).
  const subtitle = open ? dateTimeLabel : dateLabel;

  // What this event means (state-specific for a withdrawal).
  const explanation = isWithdrawal
    ? withdrawalExplanation(item.state)
    : isShareReward
      ? t("explainShare")
      : item.source === "REFERRAL_PAYOUT"
        ? t("explainReferral")
        : t("explainAdjustment");

  // ── Amount ───────────────────────────────────────────────────────────────────
  // Earnings add (green +X); money out is neutral ink (−X), struck out + muted
  // when it was returned. Never danger: red is reserved for errors (the FAILED
  // pill), and an ordinary in-flight withdrawal is not an error.
  const negative = isWithdrawal || item.amountCents < 0;
  const amountColor = moneyIn
    ? color.success
    : moneyReturned
      ? color.text.tertiary // withdrawal that never left / was credited back
      : color.text.primary; // money out: a withdrawal or a negative adjustment
  // USD is the real number; CZ locale gets an `≈ X Kč` line below it (empty for US).
  const absCents = Math.abs(item.amountCents);
  const amountUsd = `${negative ? "−" : "+"}${formatBudget(absCents, { forcedCurrency: "USD" })}`;
  const amountCzk = formatBudget(absCents, { asCzkSecondaryLine: true });

  // Each state owns a semantic color pairing (theme rule: text on a colored fill
  // uses the matching `on.*`). Saturated tones (success/danger/ink) tint their own
  // alpha fill; the pastel accents (accent/brand) fill stronger and pair with
  // their `on.*` text so the label stays readable.
  //  PROCESSING → accent (soft blue: in motion, nothing to do)
  //  DELAYED    → brand  (butter: needs the user's attention, not an error)
  //  PAID_OUT   → success (money reached the bank)
  //  FAILED     → danger  (the one true error state)
  //  REVERSED   → ink     (returned to balance: neutral, not faded)
  function withdrawalStatePill(state: WithdrawalDisplayState): {
    label: string;
    bg: string;
    fg: string;
  } {
    switch (state) {
      case "PROCESSING":
        return {
          label: t("stateProcessing"),
          bg: withAlpha(color.accent, 0.5),
          fg: color.on.accent,
        };
      case "DELAYED":
        return {
          label: t("stateDelayed"),
          bg: withAlpha(color.brand, 0.6),
          fg: color.on.brand,
        };
      case "PAID_OUT":
        return {
          label: t("statePaidOut"),
          bg: withAlpha(color.success, 0.14),
          fg: color.success,
        };
      case "FAILED":
        return {
          label: t("stateFailed"),
          bg: withAlpha(color.danger, 0.14),
          fg: color.danger,
        };
      case "REVERSED":
        return {
          label: t("stateReversed"),
          bg: withAlpha(color.ink, 0.1),
          fg: color.ink,
        };
    }
  }

  function withdrawalExplanation(state: WithdrawalDisplayState): string {
    switch (state) {
      case "PROCESSING":
        return t("explainProcessing");
      case "DELAYED":
        return t("explainDelayed");
      case "PAID_OUT":
        return t("explainPaidOut");
      case "FAILED":
        return t("explainFailed");
      case "REVERSED":
        return t("explainReversed");
    }
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
          {/* Metadata line: the withdrawal state pill leads, the date follows —
              the pill inline with the title crowded long headings (matches the
              advertiser twin). */}
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
                textDecorationLine: moneyReturned ? "line-through" : "none",
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

      {/* Expanded: what this event means (+ state for withdrawals), the exact
          time, and a link to the share for a share reward. Grows open (height
          0 → measured content height) rather than popping in; the inner view is
          absolutely positioned so onLayout reports its natural height regardless
          of the animated clip. */}
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
          {isWithdrawal && item.state === "DELAYED" ? (
            <Pressable
              onPress={openBankDetails}
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
              {bankLinkLoading ? (
                <ActivityIndicator size="small" color={color.on.ink} />
              ) : (
                <>
                  <Text style={[text.label, { color: color.on.ink }]}>
                    {t("fixBankDetails")}
                  </Text>
                  <Ionicons name="open-outline" size={14} color={color.on.ink} />
                </>
              )}
            </Pressable>
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
