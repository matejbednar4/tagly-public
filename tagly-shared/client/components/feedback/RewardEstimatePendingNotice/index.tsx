import { View, Text, StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { spacing, layout } from "../../../theme/theme";
import { withAlpha } from "../../../theme/colorUtils";

/**
 * RewardEstimatePendingNotice — the shared "we're calculating your rewards" card
 * shown on both the map and Discover while the customer is connected to Instagram
 * but their audience snapshot hasn't been taken yet
 * (`CustomerMe.instagram.hasSnapshot === false`). In that state every business's
 * reward comes back null (`NO_SNAPSHOT`), so this explains why prices read as a
 * spinner and that they're coming soon.
 *
 * Brand-filled resting card (shadow.card, no border). Informational — no CTA.
 * Caller decides placement (top of the Discover feed; floating below the map's top
 * bar) and gates rendering on the pending state — this component is presentational.
 */
export function RewardEstimatePendingNotice({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation("rewardEstimatePending");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: layout.cardPadding,
          borderRadius: radius.structure,
          backgroundColor: withAlpha(color.brand, 0.95),
          boxShadow: shadow.card,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color.ink,
        }}
      >
        <Ionicons name="sparkles" size={18} color={color.on.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMedium, { color: color.ink }]}>
          {t("title")}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {t("subtitle")}
        </Text>
      </View>
    </View>
  );
}
