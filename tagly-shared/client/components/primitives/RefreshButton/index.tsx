import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { spacing, layout } from "../../../theme/theme";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { useCooldown } from "../../../hooks/useCooldown";

/**
 * A rate-limited refresh control. Pressing fires `onPress` and starts a cooldown
 * (default 60s) during which it's disabled and shows the seconds remaining, so a
 * user can't hammer a refresh endpoint. Three states:
 *  • loading (caller's `loading` flag true) → a spinner
 *  • cooling down → a clock icon + "Ns" countdown (muted, non-pressable)
 *  • idle → the refresh icon
 *
 * Reusable anywhere a manual refresh needs throttling (stats, lists, …). To
 * throttle several affordances together (e.g. this button **and** a list's
 * pull-to-refresh), lift the cooldown into the parent and pass it via `cooldown`
 * so both share one timer.
 */
export function RefreshButton({
  onPress,
  loading = false,
  cooldownMs = 60_000,
  cooldown: externalCooldown,
  color: iconColor,
}: {
  onPress: () => void;
  /** External in-flight flag (e.g. the fetch is running) — shows a spinner. */
  loading?: boolean;
  /** Minimum gap between presses. Defaults to 60s. Ignored when `cooldown` is set. */
  cooldownMs?: number;
  /**
   * A shared cooldown (from `useCooldown(ms)` in the parent) to throttle this
   * button **together with** other refresh affordances (e.g. a list's
   * pull-to-refresh). When provided the button reflects it (countdown + disabled)
   * but leaves `start()` to the parent's `onPress` — the parent is the single
   * owner that begins the shared cooldown. Omit it to use the button's own
   * internal `cooldownMs` timer.
   */
  cooldown?: ReturnType<typeof useCooldown>;
  /** Icon tint when idle. Defaults to secondary text. */
  color?: string;
}) {
  const { theme } = useTheme();
  const { color, text } = theme;
  // Always created (rules of hooks); only used when no shared cooldown is passed.
  const internalCooldown = useCooldown(cooldownMs);
  const { secondsLeft, active, start } = externalCooldown ?? internalCooldown;
  const tint = iconColor ?? color.text.secondary;
  const disabled = loading || active;

  const handlePress = () => {
    if (disabled) return;
    onPress();
    // With a shared cooldown the parent's onPress owns start() (it spans the
    // button + pull-to-refresh); only self-start the internal timer.
    if (!externalCooldown) start();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      // Touch area comes from hitSlop, not a fixed box, so the control is only as
      // tall as its icon and doesn't inflate the row it sits in (e.g. a section
      // header). Slop brings the hit region up to ~minTapTarget around the icon.
      hitSlop={Math.round(layout.minTapTarget / 2)}
      accessibilityRole="button"
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
          justifyContent: "flex-end",
          gap: spacing.xs,
        },
        // No press feedback while disabled (cooling down / loading).
        disabled ? null : pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : active ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Ionicons name="time-outline" size={14} color={color.text.tertiary} />
          <Text style={[text.micro, { color: color.text.tertiary }]}>
            {secondsLeft}s
          </Text>
        </View>
      ) : (
        <Ionicons name="refresh" size={20} color={tint} />
      )}
    </Pressable>
  );
}
