import { ActivityIndicator, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

type LoadingProps = {
  /** Optional caption shown under the spinner. */
  text?: string;
  /**
   * Fill the available space and paint the themed background — use for
   * full-screen / route-level loading. Omit to render inline (centered in
   * whatever box the parent gives it).
   */
  fullscreen?: boolean;
  /** Override the logo + spinner color (e.g. to match a button's text). Defaults to `color.ink`. */
  color?: string;
  style?: ViewStyle;
};

/**
 * Branded loading indicator: the Tagly logo above a themed spinner, with an
 * optional caption. The single place to render "we're working on it" so the
 * brand mark can evolve in one spot. Use `fullscreen` for route-level loads and
 * the default inline form inside cards/sections.
 */
export function Loading({
  text,
  fullscreen = false,
  color: colorProp,
  style,
}: LoadingProps) {
  const { theme } = useTheme();
  const { color, text: textStyles, spacing } = theme;

  const tint = colorProp ?? color.ink;

  return (
    <View
      style={[
        { alignItems: "center", justifyContent: "center", gap: spacing.md },
        fullscreen && { flex: 1, backgroundColor: color.background },
        style,
      ]}
    >
      <ActivityIndicator color={tint} size="small" />
      {text ? (
        <Text style={[textStyles.bodyMedium, { color: color.text.secondary }]}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}
