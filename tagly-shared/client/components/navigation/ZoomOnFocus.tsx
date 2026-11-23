import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";

type Props = { children: React.ReactNode; duration?: number };

/**
 * Subtle zoom + fade-in when a screen gains focus — gives tab switches a little
 * life. Wrap a tab screen's content in it. Migrated to the new theme (no
 * light/dark; always the cream background).
 *
 * Starts at 1 to avoid a first-layout snap, animates 0→1 the first time it
 * focuses, and on every focus/blur after.
 */
export function ZoomOnFocus({ children, duration = 180 }: Props) {
  const isFocused = useIsFocused();
  const progress = useSharedValue(1);
  const hasEverFocused = useRef(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (isFocused && !hasEverFocused.current) {
      hasEverFocused.current = true;
      progress.value = 0;
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.quad),
      });
      return;
    }
    if (hasEverFocused.current) {
      progress.value = withTiming(isFocused ? 1 : 0, {
        duration,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isFocused]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * progress.value,
    transform: [{ scale: 0.99 + 0.01 * progress.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: theme.color.background }, style]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
