import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { BottomSheet, useTheme, withAlpha } from "@tagly/client";

/**
 * LockedBudgetSheet — a shared explainer bottom sheet for "locked" credits,
 * opened by tapping the Locked figure on the home `BudgetCard` or the wallet
 * `BalanceCard`. It reassures the business that locked money isn't gone: it
 * belongs to shares that haven't been paid yet, held so the customer's reward
 * is always covered. The body is a three-step timeline of the share
 * money-lifecycle from the advertiser's side (share → final price → payout,
 * with the remainder returning to available).
 *
 * Self-contained (own `open`/`onClose`) so any card can mount it without the
 * host wiring anything.
 */

const STEPS = [
  { key: "shared", icon: "camera", tone: "accent" },
  { key: "price", icon: "stats-chart", tone: "accent" },
  { key: "paid", icon: "cash", tone: "success" },
] as const;

export function LockedBudgetSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("lockedBudgetSheet");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("title")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("intro")}
          </Text>
        </View>

        {/* Timeline — one connected rail of steps. */}
        <View>
          {STEPS.map((step, i) => (
            <TimelineStep
              key={step.key}
              icon={step.icon}
              tone={step.tone}
              title={t(`${step.key}.title`)}
              body={t(`${step.key}.body`)}
              isLast={i === STEPS.length - 1}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

/** One timeline step: a tinted icon circle + a connecting rail line down to the
 *  next step, with the step's title + body alongside. */
function TimelineStep({
  icon,
  tone,
  title,
  body,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: "accent" | "success";
  title: string;
  body: string;
  isLast: boolean;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const SIZE = 40;

  const iconColor = tone === "success" ? color.success : color.on.accent;
  const chipBg =
    tone === "success"
      ? withAlpha(color.success, 0.14)
      : withAlpha(color.accent, 0.55);

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {/* Rail: icon circle + the connecting line filling the rest of the row. */}
      <View style={{ alignItems: "center", width: SIZE }}>
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: chipBg,
          }}
        >
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        {!isLast ? (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: color.border.divider,
              marginVertical: spacing.xs,
            }}
          />
        ) : null}
      </View>

      {/* Content — padded below (except the last) so the rail line spans the gap. */}
      <View
        style={{
          flex: 1,
          gap: 2,
          paddingTop: spacing.xs,
          paddingBottom: isLast ? 0 : spacing.lg,
        }}
      >
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}
