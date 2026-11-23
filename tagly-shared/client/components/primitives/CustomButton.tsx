import { ComponentProps } from "react";
import { Pressable, Text, StyleProp, ViewStyle, TextStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useTheme } from "../../theme/ThemeProvider";
import { withAlpha } from "../../theme/colorUtils";
import { pressFeedbackStyle } from "../../utils/pressFeedback";
import { Loading } from "./Loading";

/**
 * Button tier, ranked by **surface weight** (see tagly-shared/client/CLAUDE.md →
 * Buttons): solid fill > white fill + shadow > outline > text. Pick by how much
 * you want the action used, never by color.
 *
 * - `primary` — solid ink fill; the one main action per screen.
 * - `soft` — white fill + `shadow.card`; a high-traffic secondary (social login).
 * - `secondary` — outline; a subordinate / low-traffic action.
 * - `tertiary` — text only; lowest priority (skip, resend, forgot email).
 * - `destructive` — soft red fill (`dangerBg`); destructive action.
 */
type ButtonTier = "primary" | "soft" | "secondary" | "tertiary" | "destructive";

/**
 * Single-line (minimum) rendered height of every `CustomButton`, exported so
 * layouts that reserve space for a button (e.g. a pinned CTA bar, the map
 * carousel) can derive it instead of hardcoding a copy that drifts. A label that
 * wraps to two lines grows taller than this (the button uses it as a `minHeight`),
 * so treat it as the floor, not an exact height.
 */
export const CUSTOM_BUTTON_HEIGHT = 48;

type CustomButtonProps = {
  type: ButtonTier;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Icon — an Ionicons name. The button sizes it and tints it to match the tier's
   * label color, so callers never pass a color (keeps the label and icon in
   * lockstep, and enforces the one-icon-set rule).
   */
  icon?: ComponentProps<typeof Ionicons>["name"];
  /**
   * Which side of the label the `icon` sits on. Defaults to `"leading"` (before
   * the label). Use `"trailing"` for a forward/onward glyph (e.g. `arrow-forward`
   * on a "Continue" CTA), where a leading arrow would point away from the text.
   */
  iconPosition?: "leading" | "trailing";
  style?: StyleProp<ViewStyle>;
};

/**
 * The single button primitive for all tiers. Corners are always `radius.button`
 * (never pill — that's for chips). Only the `soft` tier carries an inline shadow;
 * every other tier is flat in content. Disabled collapses any tier to one muted
 * gray-brown look so "unavailable" reads the same everywhere. For inline text
 * where only part of a run is tappable (e.g. Terms/Privacy), use `PressableText`,
 * not a `tertiary` button.
 */
export function CustomButton({
  type,
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = "leading",
  style,
}: CustomButtonProps) {
  const { theme } = useTheme();
  const { color, text, radius, spacing } = theme;

  const tier = ((): {
    backgroundColor: string;
    textColor: string;
    borderColor?: string;
    boxShadow?: string;
  } => {
    if (disabled) {
      const filled =
        type === "primary" || type === "soft" || type === "destructive";
      const outlined = type === "secondary";
      return {
        backgroundColor: filled ? withAlpha(color.ink, 0.12) : "transparent",
        textColor: withAlpha(color.ink, 0.4),
        borderColor: outlined ? withAlpha(color.ink, 0.15) : undefined,
      };
    }
    switch (type) {
      case "primary":
        return { backgroundColor: color.ink, textColor: color.on.ink };
      case "soft":
        return {
          backgroundColor: color.surface,
          textColor: color.ink,
          boxShadow: theme.shadow.button,
        };
      case "secondary":
        return {
          backgroundColor: "transparent",
          textColor: color.text.primary,
          borderColor: color.border.strong,
        };
      case "tertiary":
        return { backgroundColor: "transparent", textColor: color.ink };
      case "destructive":
        // Soft red fill + a danger-tinted hairline so it separates from the
        // near-tone background (buttons own their edges; only `soft` floats).
        return {
          backgroundColor: color.dangerBg,
          textColor: color.on.dangerBg,
          borderColor: color.danger,
        };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        {
          // minHeight (not a fixed height) so a label that wraps to two lines
          // grows the button instead of clipping; vertical padding gives the
          // wrapped text breathing room while a single line still reads at 48.
          minHeight: CUSTOM_BUTTON_HEIGHT,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          gap: spacing.sm,
          borderRadius: radius.button,
          backgroundColor: tier.backgroundColor,
          ...(tier.borderColor && {
            borderWidth: 1,
            borderColor: tier.borderColor,
          }),
          ...(tier.boxShadow && { boxShadow: tier.boxShadow }),
          // Shared press feedback (scale + opacity); no hover effect while disabled.
          ...pressFeedbackStyle({
            pressed,
            hovered: disabled ? false : hovered,
          }),
        } as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <Loading color={tier.textColor} />
      ) : (
        <>
          {icon && iconPosition === "leading" ? (
            <Ionicons name={icon} size={20} color={tier.textColor} />
          ) : null}
          <Text
            style={[
              // Tertiary (text-only) reads as a lighter link at 14; the weightier
              // tiers use 16.
              type === "tertiary" ? text.label : text.bodyMedium,
              {
                color: tier.textColor,
                // Wrap + center within the available row width (beside any icon)
                // instead of capping the width, so two-line labels stay centered.
                flexShrink: 1,
                textAlign: "center",
              } as TextStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === "trailing" ? (
            <Ionicons name={icon} size={20} color={tier.textColor} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
