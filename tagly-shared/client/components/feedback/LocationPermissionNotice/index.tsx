import {
  View,
  Text,
  Pressable,
  Linking,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { spacing, layout } from "../../../theme/theme";
import { withAlpha } from "../../../theme/colorUtils";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";

/**
 * LocationPermissionNotice — the shared "turn on location" card shown on the map
 * and Discover when foreground location permission is denied
 * (`CurrentLocationContext.permissionStatus === "denied"`). In that state we have
 * no fix, so distance/nearest ranking falls back to the home market; this tells
 * the user why and offers the one way back — the OS Settings app.
 *
 * The whole card is tappable and deep-links straight to Settings; the trailing
 * chevron is the CTA affordance. Brand-filled resting card (shadow.card, no
 * border). Caller decides placement and gates rendering on the denied state.
 */
export function LocationPermissionNotice({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation("locationPermission");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void Linking.openSettings().catch(() => {})}
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
          gap: spacing.md,
          padding: layout.cardPadding,
          borderRadius: radius.structure,
          backgroundColor: withAlpha(color.brand, 0.95),
          boxShadow: shadow.card,
        },
        pressFeedbackStyle({ pressed, hovered }),
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
        <Ionicons name="location-outline" size={18} color={color.on.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMedium, { color: color.ink }]}>
          {t("title")}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {t("subtitle")}
        </Text>
      </View>
      <Ionicons name="settings-outline" size={20} color={color.ink} />
    </Pressable>
  );
}
