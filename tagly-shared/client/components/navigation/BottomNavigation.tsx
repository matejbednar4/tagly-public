import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../theme/ThemeProvider";

/** Floating-pill height (iOS with a home indicator). */
const NAV_HEIGHT = 64;
/** Classic full-width bar content height (Android / iOS without a home indicator). */
const CLASSIC_NAV_HEIGHT = 65;

export type BottomNavTab = {
  /** Must match the Expo Router screen (route) name. */
  name: string;
  label: string;
  /** Ionicons name for the active (focused) state. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Ionicons name for the inactive state (usually the `-outline` variant). */
  iconOutline: keyof typeof Ionicons.glyphMap;
};

/**
 * Bottom padding a scrolling tab screen should leave at the end of its content.
 * Always ends in a `layout.screenPadding` gap (the screen-edge convention):
 *   - **floating** mode → the pill overlays content (sits at `bottom:
 *     insets.bottom`, height `NAV_HEIGHT`), so clear its whole footprint
 *     (`insets.bottom + NAV_HEIGHT`, i.e. the bottom-menu height) + the gap.
 *   - **classic** mode → the bar is in normal flow and consumes `insets.bottom`
 *     itself (its own `paddingBottom`), so the screen ends at the bar's top
 *     edge — just the gap. Adding the inset here double-counts it (on Android
 *     edge-to-edge that floated content a whole nav-bar height too high).
 *
 * Screens with NO bottom menu (e.g. a pushed detail/list screen) shouldn't use
 * this — they pad `insets.bottom + layout.screenPadding` directly.
 */
export function useNavBottomPadding(): number {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const pad = theme.layout.screenPadding;
  if (Platform.OS === "ios" && insets.bottom > 0) {
    return insets.bottom + NAV_HEIGHT + pad;
  }
  return pad;
}

/**
 * A single tab. The icon + label scale down on press and spring back on release
 * (with a little bounce) so the bar reacts to touch instead of feeling static.
 * The Pressable keeps its full hit area; only the inner content scales.
 */
function TabItem({
  tab,
  focused,
  onPress,
}: {
  tab: BottomNavTab;
  focused: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const tint = focused ? color.ink : color.text.tertiary;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, {
          mass: 0.4,
          damping: 12,
          stiffness: 320,
        });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { mass: 0.5, damping: 9, stiffness: 220 });
      }}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: layout.minTapTarget,
      }}
    >
      <Animated.View
        style={[{ alignItems: "center", gap: spacing.xs }, animatedStyle]}
      >
        <Ionicons
          name={focused ? tab.icon : tab.iconOutline}
          size={24}
          color={tint}
        />
        <Text style={[text.label, { color: tint }]}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Shared bottom tab bar (an Expo Router custom `tabBar`) — origin/main's two
 * modes, on the new theme:
 *
 *  - **Floating pill** (iOS with a home indicator): a rounded pill that hovers
 *    over content, inset from the edges, above the home indicator.
 *  - **Classic full-width bar** (Android / iOS without a home indicator): a
 *    normal-flow bar pinned at the bottom.
 *
 * Design is centralized here; each app supplies its own `tabs`. Active =
 * `color.ink`, inactive = `color.text.tertiary`. Separation is the warm
 * `shadow.button` (pill) / the documented top shadow (bar) — never a border.
 * Tab items animate on press (see `TabItem`).
 */
export function BottomNavigation({
  state,
  navigation,
  tabs,
}: BottomTabBarProps & { tabs: BottomNavTab[] }) {
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow } = theme;
  const insets = useSafeAreaInsets();

  const currentRoute = state.routes[state.index]?.name;

  const onPress = (routeName: string) => {
    const target = state.routes.find((r) => r.name === routeName)?.key ?? "";
    const event = navigation.emit({
      type: "tabPress",
      target,
      canPreventDefault: true,
    });
    if (currentRoute !== routeName && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const tabItems = tabs.map((tab) => (
    <TabItem
      key={tab.name}
      tab={tab}
      focused={currentRoute === tab.name}
      onPress={() => onPress(tab.name)}
    />
  ));

  // Floating pill — iOS with a home indicator. The outer wrapper is 0-height
  // (its only child is absolute), so it doesn't block content; the pill floats.
  if (Platform.OS === "ios" && insets.bottom > 0) {
    return (
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: layout.screenPadding,
          zIndex: 100,
        }}
      >
        <View
          style={{
            height: NAV_HEIGHT,
            position: "absolute",
            bottom: insets.bottom,
            left: spacing.xl,
            right: spacing.xl,
            borderRadius: radius.pill,
            backgroundColor: color.surface,
            // Hovers alone over scrolling content — warm shadow, no border.
            boxShadow: shadow.button,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {tabItems}
        </View>
      </View>
    );
  }

  // Classic full-width bar — Android / iOS without a home indicator.
  return (
    <View
      style={{
        height: CLASSIC_NAV_HEIGHT + insets.bottom,
        paddingTop: spacing.sm,
        paddingBottom: insets.bottom,
        flexDirection: "row",
        backgroundColor: color.surface,
        paddingHorizontal: layout.screenPadding,
        // The bar carries the top shadow; items stay flat (no border).
        boxShadow: "0px -2px 12px rgba(56, 39, 36, 0.08)",
      }}
    >
      {tabItems}
    </View>
  );
}
