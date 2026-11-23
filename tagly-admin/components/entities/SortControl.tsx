import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, pressFeedbackStyle, BottomSheet } from "@tagly/client";

/**
 * A compact "Sort" control: a trigger pill (icon + current label + chevron) that
 * opens a bottom sheet of options — the same trigger-then-sheet pattern the
 * customer discover screen uses for its category filter. Single-select: tapping
 * an option applies it and closes.
 */
export function SortControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, shadow, radius, layout } = theme;
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
        style={({ pressed, hovered }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            alignSelf: "flex-start",
            backgroundColor: color.surface,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            boxShadow: shadow.chip,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <Ionicons name="swap-vertical" size={16} color={color.text.primary} />
        <Text style={[text.label, { color: color.text.primary }]}>
          Sort: {current?.label ?? "—"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={color.text.tertiary} />
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>Sort by</Text>
        <View style={{ marginTop: spacing.lg }}>
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed, hovered }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: layout.minTapTarget,
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: color.border.divider,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Text
                  style={[
                    active ? text.bodyMedium : text.body,
                    { color: active ? color.ink : color.text.primary },
                  ]}
                >
                  {o.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={20} color={color.ink} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}
