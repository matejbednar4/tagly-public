import { ReactNode } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { spacing } from "../../../theme/theme";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";

/**
 * SeeAllButton — the standardized "See all ›" trailing action. A low-emphasis
 * label (secondary text) + forward chevron; owns its own copy so call sites
 * don't repeat the string. Used on its own or composed inside `SectionHeader`.
 */
export function SeeAllButton({
  onPress,
  label,
}: {
  onPress: () => void;
  /** Override the default "See all" copy if a section needs different wording. */
  label?: string;
}) {
  const { t } = useTranslation("sectionHeader");
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({
        pressed,
        hovered,
      }: {
        pressed: boolean;
        hovered?: boolean;
      }) => [
        { flexDirection: "row", alignItems: "center", gap: spacing.xs },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Text style={[text.label, { color: color.text.secondary }]}>
        {label ?? t("seeAll")}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
    </Pressable>
  );
}

/**
 * SectionHeader — the one standardized on-screen section heading, used by every
 * screen so headings stay consistent and recede (the components do the talking).
 * Style matches the Discover shelves: `bodyMedium` in primary ink, NOT a Playfair
 * heading — deliberately low-prominence. Pass `onSeeAll` to append a `SeeAllButton`.
 *
 * Presentational: the caller owns placement + horizontal inset (pass `style`,
 * e.g. `{ paddingHorizontal: layout.screenPadding }` when the header sits flush
 * to a screen edge).
 *
 * Trailing slot: pass `onSeeAll` for the standard "See all ›", or `right` for a
 * custom trailing control (e.g. a refresh button). `right` wins if both are set.
 *
 * `badge` appends a small accent count pill right after the title (e.g. the
 * number of shares waiting to be rated).
 */
export function SectionHeader({
  title,
  badge,
  onSeeAll,
  seeAllLabel,
  right,
  style,
}: {
  title: string;
  badge?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const { color, text, radius } = theme;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          flexShrink: 1,
        }}
      >
        <Text
          style={[
            text.bodyMedium,
            { color: color.text.primary, flexShrink: 1 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {badge ? (
          <View
            style={{
              minWidth: 22,
              paddingHorizontal: spacing.xs,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: color.accent,
              alignItems: "center",
            }}
          >
            <Text style={[text.micro, { color: color.on.accent }]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {right ??
        (onSeeAll ? (
          <SeeAllButton onPress={onSeeAll} label={seeAllLabel} />
        ) : null)}
    </View>
  );
}
