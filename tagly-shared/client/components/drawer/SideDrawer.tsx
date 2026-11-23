import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useDrawer } from "./DrawerContext";

const DRAWER_MAX_WIDTH = 320;
const CLOSE_DURATION = 200;

/**
 * Shared right-side slide-in drawer — origin/main's drawer **logic**, on the new
 * theme. Driven entirely by the shared `useDrawer`; each app injects its own
 * `children` for the content.
 *
 * Layout, the old-app way:
 *  - Sits **below the top menu**: both the backdrop and panel start at
 *    `topOffset` (the bar's reported height), and everything is **clipped** to
 *    that region — so the drawer never casts its shadow up over the bar (the bar
 *    stays on top, casting *down* onto the drawer via the content's inset top
 *    shadow). `box-none` keeps the top-bar strip tappable.
 *  - The panel is **full screen width** so its cream fill always covers past the
 *    right edge (no gap on the spring's overshoot); the visible content occupies
 *    the left `drawerWidth`, landing flush against the right edge.
 *
 * Springs in from the right over a warm ink scrim that fades in; tapping the
 * scrim closes it. Mounts only while visible (through the close animation).
 */
export function SideDrawer({ children }: { children: ReactNode }) {
  const { drawerOpen, closeDrawer, topOffset } = useDrawer();
  const { theme } = useTheme();
  const { color } = theme;
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(screenWidth * 0.7, DRAWER_MAX_WIDTH);

  // Closed = panel parked fully off the right (translateX = screenWidth); open =
  // shifted so its left `drawerWidth` lands flush against the right edge.
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const opacity = useRef(new Animated.Value(0)).current; // backdrop scrim
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let current = true;
    if (drawerOpen) {
      translateX.setValue(screenWidth);
      opacity.setValue(0);
      setVisible(true);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: screenWidth - drawerWidth,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: CLOSE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: CLOSE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: CLOSE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (current && !drawerOpen) setVisible(false);
      });
    }
    return () => {
      current = false;
    };
  }, [drawerOpen, drawerWidth, screenWidth]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
      }}
    >
      {/* Clip to below the top menu — the drawer's shadow can't bleed up over the
          bar, and the bar stays on top. `box-none` keeps that top strip tappable. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: topOffset,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {/* Backdrop scrim — warm ink, fades in; tap to close. */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(56, 39, 36, 0.4)",
            opacity,
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={closeDrawer}
            accessibilityRole="button"
          />
        </Animated.View>

        {/* Full-width panel — its cream fill always covers past the right edge. */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: screenWidth,
            backgroundColor: color.background,
            transform: [{ translateX }],
          }}
        >
          {/* Visible content occupies the left `drawerWidth` (= the right strip on
              screen). Inset top shadow = the top menu casting down onto the
              drawer; left-edge shadow separates it from the backdrop. Fills the
              full height (no bottom safe-area inset here) so the child can reach
              the bottom edge — the child owns its bottom inset (e.g. inside a
              scroll's `contentContainerStyle.paddingBottom`), so the scroll
              surface bleeds to the bottom instead of leaving a gap. */}
          <View
            style={{
              width: drawerWidth,
              height: "100%",
              boxShadow:
                "inset 0px 5px 8px rgba(56, 39, 36, 0.10), -2px 0px 12px rgba(56, 39, 36, 0.08)",
            }}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
