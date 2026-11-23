import { ActivityIndicator, View, StyleProp, ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { spacing } from "../../../theme/theme";

/**
 * RewardCalculatingIndicator — the in-place "we're working out this reward"
 * affordance shown wherever a business's reward estimate would go (the map
 * marker, the BusinessPreview card) while the customer's Instagram audience
 * snapshot is still being taken (reward is null with the `NO_SNAPSHOT` slug).
 *
 * A money icon + a small spinner — deliberately NOT green and NOT a number, so
 * it reads as "a reward is coming" rather than a real earned amount. Tint
 * defaults to the muted `text.tertiary` tier; callers can override on dark fills
 * (e.g. the selected ink marker passes `on.ink`).
 */
export function RewardCalculatingIndicator({
  iconSize = 13,
  color,
  style,
}: {
  iconSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const tint = color ?? theme.color.text.tertiary;
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing.xs },
        style,
      ]}
    >
      <Ionicons name="cash-outline" size={iconSize} color={tint} />
    </View>
  );
}
