import { useEffect, type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
import { useDrawer } from "../drawer/DrawerContext";

export type TopMenuProps = {
  /** The screen heading — always shown. */
  title: string;
  /**
   * Detail screens set this: a back chevron appears on the left and the heading
   * moves to the center. Tab roots omit it → the heading is a big left title and
   * there is no back button. (origin/main's "heading-left, or back + centered
   * heading" layout.)
   */
  showBack?: boolean;
  /**
   * Optional secondary line shown under the title (e.g. a detail screen's
   * business type). Follows the title's alignment (centered when `showBack`).
   */
  subheading?: string;
  /**
   * Hide the right-side menu (hamburger) button. Shown by default (it toggles
   * the shared drawer on press); pass `hideMenu` in an app with no drawer (e.g.
   * admin) so no dead button renders. When combined with `showBack`, an
   * equal-width spacer replaces it so the centered heading stays centered.
   */
  hideMenu?: boolean;
  /**
   * A custom right-side icon button, replacing the drawer button entirely (takes
   * priority over the hamburger). For apps with no drawer that still want a bar
   * action — e.g. admin's "Log out". The screen owns the press (confirm etc.).
   */
  rightAction?: {
    icon: ComponentProps<typeof Ionicons>["name"];
    onPress: () => void;
    accessibilityLabel?: string;
  };
};

/**
 * Shared top bar (design centralized). The menu button toggles the shared drawer
 * on its own — apps just set `title` (+ `showBack`/`hideMenu` where needed).
 * A single row: when `showBack` the heading is **centered** with a back chevron
 * on the left; otherwise it's a big **left** `display` heading. An optional menu
 * button sits on the right. It always drops a soft downward shadow to separate it
 * from the content below. No border (design system).
 */
export function TopMenu({
  title,
  showBack = false,
  subheading,
  hideMenu = false,
  rightAction,
}: TopMenuProps) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The menu button toggles the shared drawer, and we report the bar's height so
  // the drawer can sit below it (both no-ops without a DrawerProvider).
  const { setTopOffset, toggleDrawer, drawerOpen } = useDrawer();

  const menuSize = (text.display.fontSize as number | undefined) ?? 32;

  // Menu ⟷ close morph: a rotating cross-fade between the hamburger and the X,
  // driven by the drawer's open state (0 = menu, 1 = close).
  const menuProgress = useSharedValue(drawerOpen ? 1 : 0);
  useEffect(() => {
    menuProgress.value = withTiming(drawerOpen ? 1 : 0, { duration: 220 });
  }, [drawerOpen]);
  const menuRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${menuProgress.value * 90}deg` }],
  }));
  const hamburgerStyle = useAnimatedStyle(() => ({
    opacity: 1 - menuProgress.value,
  }));
  const closeStyle = useAnimatedStyle(() => ({ opacity: menuProgress.value }));

  return (
    <View
      onLayout={(e) => setTopOffset(e.nativeEvent.layout.height)}
      // Lift above sibling content (notably the native MapView) so the downward
      // shadow paints on top of it instead of being covered. zIndex (not Android
      // elevation) so we don't draw a second, all-sides elevation shadow.
      style={{ zIndex: 10 }}
    >
      {/* Drop-shadow layer (behind the content): always on. The content layer on
          top provides the opaque background, so this layer contributes only the
          downward shadow, never affects the bar's fill. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: color.surface,
          boxShadow: "0px 2px 12px rgba(56, 39, 36, 0.08)",
        }}
      />

      <View
        style={{
          backgroundColor: color.surface,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: layout.screenPadding,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Left: back chevron (detail screens only). */}
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            style={{
              width: layout.minTapTarget,
              height: layout.minTapTarget,
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={color.ink}
              style={{ marginLeft: -6 }}
            />
          </Pressable>
        )}

        {/* Heading: big left `display` (root), or centered `title` (detail),
            with an optional secondary line beneath it. */}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              showBack ? text.title : text.display,
              {
                color: color.text.primary,
                textAlign: showBack ? "center" : "left",
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subheading ? (
            <Text
              style={[
                text.caption,
                {
                  color: color.text.secondary,
                  textAlign: showBack ? "center" : "left",
                },
              ]}
              numberOfLines={1}
            >
              {subheading}
            </Text>
          ) : null}
        </View>

        {/* Right slot, in priority order: a custom `rightAction` icon button →
            the drawer (hamburger) button → (when `hideMenu` + `showBack`) an
            equal-width spacer so the centered heading stays centered → nothing. */}
        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
            style={{
              minWidth: layout.minTapTarget,
              height: layout.minTapTarget,
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            <Ionicons name={rightAction.icon} size={24} color={color.ink} />
          </Pressable>
        ) : !hideMenu ? (
          <Pressable
            onPress={toggleDrawer}
            hitSlop={8}
            accessibilityRole="button"
            style={{
              minWidth: layout.minTapTarget,
              height: layout.minTapTarget,
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            {/* Hamburger and close stacked; rotate + cross-fade between them. */}
            <Animated.View
              style={[{ width: menuSize, height: menuSize }, menuRotateStyle]}
            >
              <Animated.View style={[{ position: "absolute" }, hamburgerStyle]}>
                <Ionicons name="menu" size={menuSize} color={color.ink} />
              </Animated.View>
              <Animated.View style={[{ position: "absolute" }, closeStyle]}>
                <Ionicons name="close" size={menuSize} color={color.ink} />
              </Animated.View>
            </Animated.View>
          </Pressable>
        ) : showBack ? (
          <View
            style={{ width: layout.minTapTarget, height: layout.minTapTarget }}
          />
        ) : null}
      </View>
    </View>
  );
}
