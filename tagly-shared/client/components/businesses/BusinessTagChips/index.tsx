import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../../theme/ThemeProvider";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { showToast } from "../../feedback/toast";

/**
 * BusinessTagChips — the business's matchable tags (name, alternative names,
 * @handle) as a wrapping row of accent pills. A story must clearly show at
 * least one of them for a share to verify, so the same row appears wherever
 * that requirement is stated: the business detail page, the share-create story
 * picker, and the "story wasn't tagged" guidance screen.
 *
 * Every chip copies its own text to the clipboard — on press AND on long press,
 * since people reach for either — and confirms with a success toast. Copying is
 * the whole point of the row: the tag has to be typed into an Instagram story
 * exactly, and a mistyped handle is a failed share.
 *
 * The chips stay visually identical everywhere (the row owns its own look; the
 * only prop is where it aligns, because the guidance screen is a centered hero
 * layout while the other two lead from the left). The 44pt tap target comes
 * from `hitSlop`, NOT from padding — the design rule is about touch area, not
 * visible size, and inflating a small pill into a 44pt-tall slab would make a
 * one-line tag look like a button.
 */
export function BusinessTagChips({
  tags,
  align = "flex-start",
}: {
  tags: string[];
  /** Row alignment — chips center on the guidance screen, lead elsewhere. */
  align?: "flex-start" | "center";
}) {
  const { t } = useTranslation("businessTagChips");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing } = theme;

  if (tags.length === 0) return null;

  const copy = async (tag: string) => {
    await Clipboard.setStringAsync(tag);
    showToast({ type: "success", text1: t("copied") });
  };

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: align,
      }}
    >
      {tags.map((tag) => (
        <Pressable
          key={tag}
          onPress={() => copy(tag)}
          onLongPress={() => copy(tag)}
          accessibilityRole="button"
          accessibilityLabel={tag}
          accessibilityHint={t("copyHint")}
          // Vertical only: the row's own 8pt gap is the sole dead space, so
          // extending up/down can't steal a neighbour's tap the way widening a
          // side-by-side pair in the same line would.
          hitSlop={{ top: spacing.md, bottom: spacing.md }}
          // Annotated because this package compiles with react-native types
          // only — RN's own PressableStateCallbackType has no `hovered` (it
          // comes from react-native-web, which the apps pull in).
          style={({
            pressed,
            hovered,
          }: {
            pressed: boolean;
            hovered?: boolean;
          }) => [
            {
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: color.accent,
              boxShadow: shadow.chip,
            },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <Text style={[text.label, { color: color.on.accent }]}>{tag}</Text>
        </Pressable>
      ))}
    </View>
  );
}
