import { Pressable, Text } from "react-native";
import { useTheme, pressFeedbackStyle } from "@tagly/client";

/**
 * A selectable pill for the entity type / sort selectors. Follows the design
 * system's selected-state pattern: active = ink fill + `on.ink` text; inactive =
 * white surface + `shadow.chip` (never a border). Press feedback via the shared
 * helper.
 */
export function EntityChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, shadow, radius } = theme;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: active ? color.ink : color.surface,
          ...(active ? {} : { boxShadow: shadow.chip }),
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Text
        style={[
          text.label,
          { color: active ? color.on.ink : color.text.secondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
