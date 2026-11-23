import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast, { BaseToast, BaseToastProps } from "react-native-toast-message";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * App-wide toast root + styling, themed for the design system. Mount once in the
 * app's root layout; `showToast()` from `@tagly/client` drives it.
 *
 * Three variants — pass via `type` to `showToast()`:
 * - `success` — green (positive confirmation)
 * - `error`   — red (something failed)
 * - `info`    — neutral theme colors (general notice; the default)
 *
 * Toasts sit at the bottom and ride above the keyboard when it's open
 * (`avoidKeyboard`; iOS-only in the library).
 */
export function AppToast() {
  const { theme } = useTheme();
  const { color, text, layout, radius } = theme;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /** One card shape per variant; only the colors change. */
  const variant =
    (opts: { bg: string; accent: string; title: string; body: string }) =>
    (props: BaseToastProps) => (
      <BaseToast
        {...props}
        style={{
          minHeight: 48,
          height: undefined,
          maxWidth: width - 2 * layout.screenPadding,
          backgroundColor: opts.bg,
          borderRadius: radius.structure,
          borderLeftColor: opts.accent,
          boxShadow: theme.shadow.float,
        }}
        contentContainerStyle={{ paddingVertical: layout.cardPadding }}
        text1Style={[text.label, { color: opts.title }]}
        text2Style={[text.caption, { color: opts.body }]}
        text1NumberOfLines={2}
        text2NumberOfLines={5}
      />
    );

  return (
    <Toast
      position="bottom"
      bottomOffset={insets.bottom + 8}
      avoidKeyboard
      keyboardOffset={8}
      visibilityTime={5000}
      config={{
        success: variant({
          bg: color.successBg,
          accent: color.success,
          title: color.on.successBg,
          body: color.on.successBg + "CC",
        }),
        error: variant({
          bg: color.dangerBg,
          accent: color.danger,
          title: color.on.dangerBg,
          body: color.on.dangerBg + "CC",
        }),
        info: variant({
          bg: color.surface,
          accent: color.ink,
          title: color.text.primary,
          body: color.text.secondary,
        }),
      }}
      swipeable={true}
    />
  );
}
