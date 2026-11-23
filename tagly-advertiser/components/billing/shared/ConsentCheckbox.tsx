import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, pressFeedbackStyle } from "@tagly/client";

/**
 * The EU charge-authorization checkbox, shared by every sheet that captures an
 * off-session mandate (pay as you go, monthly top-up, adding a card). US
 * locales render the same sentence as a plain disclosure line instead — the
 * `isEULocale` branch lives at the call site, since only the caller knows which
 * sentence it needs.
 *
 * Visually it is the app's ONE consent-row pattern, identical to the customer
 * app's create-share consent and the shared ToS / Privacy re-acceptance modals:
 * a 24px box at `radius.button`, white with a hairline while unticked and an
 * ink fill with an on-ink check once ticked (the design system's selected-state
 * pattern — an input edge is the sanctioned place for a border), `spacing.md`
 * to the label, `hitSlop` for the tap target, and `pressFeedbackStyle` so it
 * responds like every other tappable surface. Keep it in step with those two if
 * either ever changes.
 */
export function ConsentCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        { flexDirection: "row", alignItems: "center", gap: spacing.md },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.button,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: checked ? color.ink : color.surface,
          borderWidth: checked ? 0 : 1.5,
          borderColor: color.border.strong,
        }}
      >
        {checked && (
          <Ionicons name="checkmark" size={16} color={color.on.ink} />
        )}
      </View>
      <Text style={[text.caption, { color: color.text.primary, flex: 1 }]}>
        {label}
      </Text>
    </Pressable>
  );
}
