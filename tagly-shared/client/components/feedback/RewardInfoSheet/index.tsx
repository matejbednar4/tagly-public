import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { withAlpha } from "../../../theme/colorUtils";
import { BottomSheet } from "../../overlays/BottomSheet";

/**
 * RewardInfoSheet — a simple, non-revealing explainer of what affects a reward
 * (customer voice) or a share's price (advertiser voice) — the SAME factors in
 * both, since the reward and the price are the same number seen from each side.
 *
 * Deliberately **qualitative**: it names the levers (reach, location, audience,
 * quality, frequency, reshares) with no numbers, rates, or weights, so the
 * reward algorithm stays private. Shared so the customer's share-detail +
 * business-detail screens and the advertiser's share detail all open the *same*
 * sheet from an ⓘ. `variant` swaps only the wording: `"customer"` (default)
 * speaks of the reward earned, `"advertiser"` of the price paid — the factor
 * list itself must never diverge between the two.
 *
 * Presentational: the caller owns the open state and renders an info affordance.
 */
export function RewardInfoSheet({
  open,
  onClose,
  variant = "customer",
}: {
  open: boolean;
  onClose: () => void;
  variant?: "customer" | "advertiser";
}) {
  const { t } = useTranslation("rewardInfo");
  const { theme } = useTheme();
  const { color, text, radius, spacing } = theme;

  // Advertiser strings live under the `advertiser.` subtree of the same
  // namespace; the shared factor titles stay at the root.
  const p = variant === "advertiser" ? "advertiser." : "";

  const factors: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    desc: string;
  }[] = [
    { icon: "eye-outline", title: t("reachTitle"), desc: t(`${p}reachDesc`) },
    {
      icon: "location-outline",
      title: t("locationTitle"),
      desc: t(`${p}locationDesc`),
    },
    {
      icon: "people-outline",
      title: t("audienceTitle"),
      desc: t(`${p}audienceDesc`),
    },
    {
      icon: "sparkles-outline",
      title: t("qualityTitle"),
      desc: t(`${p}qualityDesc`),
    },
    {
      icon: "calendar-outline",
      title: t("frequencyTitle"),
      desc: t(`${p}frequencyDesc`),
    },
    {
      icon: "repeat-outline",
      title: t("reshareTitle"),
      desc: t(`${p}reshareDesc`),
    },
  ];

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[text.title, { color: color.text.primary }]}>
        {t(`${p}title`)}
      </Text>

      <View style={{ gap: spacing.lg }}>
        {factors.map((f) => (
          <View
            key={f.title}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color.accent,
              }}
            >
              <Ionicons name={f.icon} size={18} color={color.on.accent} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs / 2 }}>
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {f.title}
              </Text>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {f.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[text.caption, { color: color.text.tertiary }]}>
        {t(`${p}footer`)}
      </Text>
    </BottomSheet>
  );
}
