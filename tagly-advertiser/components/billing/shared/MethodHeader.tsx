import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { useTheme } from "@tagly/client";

/**
 * The shared visual + verbal identity of the three funding methods, used by
 * every billing card and sheet so a method always looks and reads the same:
 *
 * - **credits** = `wallet-outline` on accent (blue)
 * - **payg** = `flash-outline` on brand (butter)
 * - **monthlyBudget** = `calendar-outline` on accent (blue — it IS credits,
 *   bought on a schedule; butter stays PAYG's alone so the two accents never
 *   sit side by side on the Wallet)
 *
 * (The same pairing as the setup chooser's ModeCards.) Copy comes from the
 * feature-level `billing` namespace (`billing.{en,cs}.json` in this folder) —
 * the single source of truth for each method's title, tagline, and three-point
 * pitch (see `MethodBenefits`).
 */
export type FundingMethod = "credits" | "payg" | "monthlyBudget";

const IDENTITY: Record<
  FundingMethod,
  { icon: keyof typeof Ionicons.glyphMap }
> = {
  credits: { icon: "wallet-outline" },
  payg: { icon: "flash-outline" },
  monthlyBudget: { icon: "calendar-outline" },
};

/** The method's round icon chip alone — for method rows in explainer sheets. */
export function MethodChip({
  method,
  size = 40,
}: {
  method: FundingMethod;
  size?: number;
}) {
  const { theme } = useTheme();
  const { color, radius } = theme;
  const bg = method === "payg" ? color.brand : color.accent;
  const fg = method === "payg" ? color.ink : color.on.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Ionicons name={IDENTITY[method].icon} size={size / 2} color={fg} />
    </View>
  );
}

/**
 * Chip + canonical title/tagline row — the header of every funding card and
 * sheet. `trailing` slots a status pill on the right (e.g. `PaygSheet`).
 *
 * The words are **always** the method's own, from the `billing` namespace. A
 * flow that needs to say something else says it in its own step, not by
 * re-wording this header: the monthly sheet's post-purchase offer is a question
 * screen in front of the form, which is what keeps the form identical however
 * it was reached.
 */
export function MethodHeader({
  method,
  trailing,
}: {
  method: FundingMethod;
  trailing?: ReactNode;
}) {
  const { t } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
    >
      <MethodChip method={method} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.heading, { color: color.text.primary }]}>
          {t(`${method}.title`)}
        </Text>
        <Text
          style={[text.caption, { color: color.text.secondary }]}
          numberOfLines={2}
        >
          {t(`${method}.tagline`)}
        </Text>
      </View>
      {trailing}
    </View>
  );
}
