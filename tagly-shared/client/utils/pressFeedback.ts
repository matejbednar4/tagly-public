import { ViewStyle } from "react-native";

/**
 * The one standard press feedback for tappable surfaces (buttons, cards, tiles):
 * a subtle scale-down + opacity dip while pressed. Spread the result into a
 * `Pressable`'s style **alongside** the
 * surface's own styles, so every tappable thing reacts identically:
 *
 *   <Pressable style={({ pressed, hovered }) => [base, pressFeedbackStyle({ pressed, hovered })]} />
 *
 * Centralized so `CustomButton`, stat cards, the budget tiles, the feedback
 * tile, etc. all share the exact same feel — tune it here, everywhere updates.
 */
export function pressFeedbackStyle({
  pressed,
  hovered,
}: {
  pressed: boolean;
  hovered?: boolean;
}): ViewStyle {
  return {
    opacity: pressed ? 0.85 : hovered ? 0.92 : 1,
    transform: [{ scale: pressed ? 0.98 : 1 }],
  };
}
