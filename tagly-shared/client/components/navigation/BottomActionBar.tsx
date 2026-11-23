import { ReactNode } from "react";
import { View } from "react-native";
import {
  KeyboardStickyView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";

/** How the bar reacts to the keyboard. */
export type BottomActionBarKeyboardBehavior =
  /** Rise and stay above the keyboard (frame-synced). Good when the CTA should
   *  stay reachable while typing — e.g. a single amount field + submit. */
  | "lift"
  /** Fade out + go inert while the keyboard is up, so it can't cover the focused
   *  field. Pair with a `KeyboardAwareScrollView` that keeps the field visible.
   *  The bar stays MOUNTED (no remount churn) — it's just hidden. */
  | "hide";

/**
 * The canonical pinned bottom action bar. Absolutely positioned over scrolling
 * content, it carries the top shadow while the buttons inside stay flat (per the
 * design system's elevation rules). One home for the padding so every screen with
 * this layout matches:
 *
 *  - bottom: `insets.bottom + layout.screenPadding` (home-indicator clearance + the
 *    standard screen-edge gap),
 *  - top: `spacing.lg` of breathing room,
 *  - horizontal: `layout.screenPadding`.
 *
 * **Keyboard** (`keyboardBehavior`, default `"lift"`): both modes run on
 * react-native-keyboard-controller (`KeyboardProvider` is mounted at each app
 * root), so behaviour is identical on iOS + Android.
 *  - `"lift"` — a `KeyboardStickyView` rides the bar above the keyboard, exactly
 *    tracking its animation. The `opened` offset re-claims the home-indicator
 *    inset the keyboard now covers, so the buttons keep their resting
 *    `screenPadding` gap above the keyboard.
 *  - `"hide"` — the bar fades out and stops receiving touches while the keyboard
 *    is up (a focused field's `KeyboardAwareScrollView` handles visibility). It
 *    stays mounted, so `onHeightChange` never churns and there's no remount flash.
 *
 * The bar overlays content, so the scroll/list above must reserve room for it:
 * pass `onHeightChange` and add the reported height (+ a gap) to that content's
 * `paddingBottom`. `gap` controls the space between stacked children (default sm).
 */
export function BottomActionBar({
  children,
  onHeightChange,
  gap,
  keyboardBehavior = "lift",
}: {
  children: ReactNode;
  onHeightChange?: (height: number) => void;
  gap?: number;
  keyboardBehavior?: BottomActionBarKeyboardBehavior;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;
  const insets = useSafeAreaInsets();

  // Only matters for "hide": fade + disable the bar while the keyboard is up.
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const hidden = keyboardBehavior === "hide" && keyboardVisible;

  const style = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: hidden ? 0 : 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: insets.bottom + layout.screenPadding,
    backgroundColor: color.background,
    // The one warm top shadow for a pinned bar (see design system elevation);
    // not a theme token, so it lives here as the single source.
    boxShadow: "0 -2px 12px rgba(56,39,36,0.08)",
    gap: gap ?? spacing.sm,
  };

  const onLayout = onHeightChange
    ? (e: { nativeEvent: { layout: { height: number } } }) =>
        onHeightChange(e.nativeEvent.layout.height)
    : undefined;

  // "lift": KeyboardStickyView is a drop-in for the old manual Animated lift — it
  // sticks the bar above the keyboard. `opened: insets.bottom` shifts it back
  // down by the home-indicator inset (hidden while the keyboard is up), keeping
  // the resting gap.
  if (keyboardBehavior === "lift") {
    return (
      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        onLayout={onLayout}
        style={style}
      >
        {children}
      </KeyboardStickyView>
    );
  }

  // "hide": stays pinned; the opacity/pointerEvents above do the hiding.
  return (
    <View
      onLayout={onLayout}
      pointerEvents={hidden ? "none" : "auto"}
      style={style}
    >
      {children}
    </View>
  );
}
