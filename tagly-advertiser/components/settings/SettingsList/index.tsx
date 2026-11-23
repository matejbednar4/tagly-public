import { Children, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { pressFeedbackStyle, SectionHeader, useTheme } from "@tagly/client";

/** Row icon size — the between-row divider is inset to line up past it. */
const ROW_ICON_SIZE = 22;

/**
 * Uniform row height — every row is this tall (with or without a subtitle) so
 * the list reads as an even grid.
 */
const ROW_MIN_HEIGHT = 64;

/**
 * The settings grouped-list pattern (twin of the customer's) — shared by the
 * global settings hub and the per-business settings hub. A titled group of
 * rows rendered as one shadow card (no border — separation is `shadow.card`),
 * with a hairline divider between rows inset to align under the row labels.
 */
export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout, radius, shadow } = theme;
  const rows = Children.toArray(children);

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} />
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginLeft: layout.cardPadding + ROW_ICON_SIZE + spacing.md,
                  backgroundColor: color.border.divider,
                }}
              />
            ) : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One settings row: an ink (or danger) icon + label (with an optional subtitle),
 * and a trailing chevron for internal drill-ins or an `open` glyph for external
 * links. Pass `href` to navigate, or `onPress` for a link / custom action.
 */
export function SettingsRow({
  icon,
  label,
  subtitle,
  href,
  onPress,
  external = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  href?: Href;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const tint = danger ? color.danger : color.ink;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={href ? () => router.push(href) : onPress}
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: ROW_MIN_HEIGHT,
          paddingHorizontal: layout.cardPadding,
          paddingVertical: spacing.sm,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name={icon} size={ROW_ICON_SIZE} color={tint} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            text.bodyMedium,
            { color: danger ? color.danger : color.text.primary, lineHeight: 20 },
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={external ? "open-outline" : "chevron-forward"}
        size={external ? 16 : 18}
        color={color.text.tertiary}
      />
    </Pressable>
  );
}
