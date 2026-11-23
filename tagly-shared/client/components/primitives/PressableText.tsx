import { useState, type ReactNode } from "react";
import { Text, StyleProp, TextStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Loading } from "./Loading";

type PressableTextProps = {
  /** Link label. Optional so it composes with `<Trans>`, which injects children. */
  children?: ReactNode;
  onPress: () => void;
  /** Text color; defaults to the theme ink (link affordance). */
  color?: string;
  /** Override/extend the text style — applied last, so it wins (e.g. size). */
  style?: StyleProp<TextStyle>;
  /** Show a spinner (in the text color) instead of the label; also blocks taps. */
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Inline tappable text — use ONLY when part of a text run needs to be pressable
 * (e.g. the "Terms" / "Privacy" links inside a sentence, via `<Trans>`). For a
 * standalone whole-label action (skip, resend, forgot email) use a `tertiary`
 * `CustomButton` instead — that's the button primitive's job, not this.
 *
 * Underlined unless disabled. Defaults to `text.label` sizing and `color.ink`;
 * pass `style` to match a surrounding run (e.g. `text.caption`) and `color` to
 * recolor.
 */
export function PressableText({
  children,
  onPress,
  color,
  style,
  loading = false,
  disabled = false,
}: PressableTextProps) {
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const textColor = color ?? theme.color.ink;

  if (loading) return <Loading color={textColor} />;

  // Opacity: disabled > pressed > normal.
  const opacity = disabled ? 0.75 : isPressed ? 0.5 : 1;

  return (
    <Text
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      suppressHighlighting
      style={[
        theme.text.label,
        {
          color: textColor,
          textDecorationLine: disabled ? "none" : "underline",
          opacity,
        } as TextStyle,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
