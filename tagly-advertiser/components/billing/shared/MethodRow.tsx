import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, pressFeedbackStyle, withAlpha } from "@tagly/client";

/**
 * One row of the "How you pay" group — the workhorse of the settings model.
 * A row REPORTS state and opens a sheet; it never carries a sales pitch, which
 * is the whole distinction that stops a funded advertiser from being re-sold
 * something they already declined (a card recommends, a row informs).
 *
 * Anatomy: tone-coloured icon chip · title (+ optional sub) · right-aligned
 * value · chevron. The chip's tone is the state at a glance — accent while the
 * rule is on, butter for pay as you go (its brand colour), danger while it
 * needs attention, grey while off.
 */
export type RowTone = "on" | "payg" | "danger" | "off";

export function MethodRow({
  icon,
  tone,
  title,
  sub,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: RowTone;
  title: string;
  sub?: string;
  value?: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;

  const chip =
    tone === "on"
      ? { bg: color.accent, fg: color.on.accent }
      : tone === "payg"
        ? { bg: color.brand, fg: color.ink }
        : tone === "danger"
          ? { bg: color.dangerBg, fg: color.on.dangerBg }
          : { bg: withAlpha(color.ink, 0.08), fg: color.text.tertiary };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Visually slim, but the hit area stays at the 44pt minimum.
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
          gap: spacing.md,
          minHeight: 36,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chip.bg,
        }}
      >
        <Ionicons name={icon} size={15} color={chip.fg} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
        {sub ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[
            text.caption,
            {
              color: tone === "danger" ? color.danger : color.text.secondary,
              textAlign: "right",
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={14} color={color.text.tertiary} />
    </Pressable>
  );
}
