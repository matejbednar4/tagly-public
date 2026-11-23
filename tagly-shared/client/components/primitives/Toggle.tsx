import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * On-theme toggle: an ink (on) / muted (off) pill track with a knob that slides
 * between the two ends. Deliberately custom rather than RN's `Switch` — it
 * matches the design tokens exactly and avoids `Switch`'s buggy
 * `ios_backgroundColor`. Only the knob's `translateX` animates (native-driven);
 * the track color swaps.
 */
export function Toggle({
  value,
  disabled,
  onValueChange,
}: {
  value: boolean;
  disabled?: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const { theme } = useTheme();
  const { color, shadow, radius } = theme;

  const TRACK_W = 46;
  const TRACK_H = 28;
  const KNOB = 22;
  const PAD = 3;
  const travel = TRACK_W - KNOB - PAD * 2;

  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travel],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: radius.pill,
          padding: PAD,
          backgroundColor: value ? color.ink : color.border.strong,
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: radius.pill,
            backgroundColor: value ? color.brand : color.surface,
            boxShadow: shadow.chip,
            transform: [{ translateX }],
          }}
        />
      </View>
    </Pressable>
  );
}
