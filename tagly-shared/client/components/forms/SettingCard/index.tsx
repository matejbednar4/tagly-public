import { type ComponentProps, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { withAlpha } from "../../../theme/colorUtils";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";

export type SettingIconName = ComponentProps<typeof Ionicons>["name"];

/**
 * SettingCard — the shared chrome for a settings field, shared across apps. It
 * owns the card (shadow, no border — separation is the card), the leading-icon +
 * heading row with an optional top-right control, an optional subheading + note,
 * and an animated height (`LinearTransition`) so a field can grow open smoothly.
 * The body is whatever the field needs (a value, an input, chips, a picker) —
 * `EditableSetting` builds the text field on top of this; gender/interests fields
 * pass their own controls.
 */
export function SettingCard({
  icon,
  heading,
  subheading,
  right,
  note,
  children,
}: {
  icon?: SettingIconName;
  heading: string;
  subheading?: string;
  /** Top-right control (e.g. an Edit/action pill). */
  right?: ReactNode;
  /** Caption under the field — help text or a cooldown message. */
  note?: string;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPadding,
        boxShadow: shadow.card,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          minHeight: layout.minTapTarget - spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            flex: 1,
          }}
        >
          {icon ? (
            <Ionicons name={icon} size={20} color={color.text.secondary} />
          ) : null}
          <Text style={[text.label, { color: color.text.secondary }]}>
            {heading}
          </Text>
        </View>
        {right}
      </View>

      {subheading ? (
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {subheading}
        </Text>
      ) : null}

      {children}

      {note ? (
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {note}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * The small rounded affordance in a field's top-right — a butter pill with a
 * leading icon (a pencil for "Edit", a chevron for a launch action). Mutes to an
 * inert grey when disabled (cooldown/lock). Shared so `EditableSetting` and the
 * gender/interests fields use the exact same control.
 */
export function AffordancePill({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: SettingIconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const tint = disabled ? color.text.tertiary : color.on.brand;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: disabled ? withAlpha(color.ink, 0.05) : color.brand,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name={icon} size={15} color={tint} />
      <Text style={[text.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}
