import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../theme/ThemeProvider";
import { pressFeedbackStyle } from "../../../utils/pressFeedback";
import { BottomActionBar } from "../../navigation/BottomActionBar";

/**
 * One create-business step (also the shared body of the edit screens). The
 * back-arrow row, title, and fields live in ONE scroll view; the CTA (+ optional
 * footer) is pinned in a `BottomActionBar` so it stays visible while the fields
 * scroll — the same always-reachable save/continue on every create step and
 * every business-settings edit screen. The bar carries the top shadow and owns
 * the bottom safe-area inset; the scroll reserves its measured height as
 * `paddingBottom` so content never sits under it.
 *
 * Keyboard: the scroll is a `KeyboardAwareScrollView` (react-native-keyboard-
 * controller — identical behaviour on iOS + Android), which lifts the focused
 * field's caret `bottomOffset` above the keyboard (large enough that the whole
 * 56px field clears it — see the prop). The pinned CTA uses the bar's own
 * `keyboardBehavior="hide"` — it fades out (stays mounted) while typing so it
 * can't cover the field, and returns on dismiss.
 */
export function StepShell({
  header,
  title,
  subtitle,
  onBack,
  children,
  cta,
  footer,
  topInset = true,
}: {
  /** Scrolls with the content above the title (e.g. the progress overline). */
  header?: ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  cta: ReactNode;
  footer?: ReactNode;
  /**
   * Pad the top safe-area inset into the scroll (default). Hosts that render
   * their own top bar above the wizard (the in-app screen's TopMenu) pass
   * false — the bar already consumes the inset, so the step only keeps the
   * standard screen-edge gap below it.
   */
  topInset?: boolean;
}) {
  const { t } = useTranslation("businessPageForm");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const insets = useSafeAreaInsets();
  // The pinned bar overlays the scroll, so reserve its measured height (+ a gap)
  // as the scroll's bottom padding — content scrolls clear of it, never under.
  const [barHeight, setBarHeight] = useState(0);
  // Shared micro/uppercase/tertiary treatment so the "Previous" control reads
  // as a matched pair with the progress overline.
  const microMeta = {
    ...text.micro,
    color: color.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  };
  return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        // bottomOffset is measured to the CARET, not the field's bottom edge —
        // so it must clear ~half the input height (CustomTextInput is 56 tall)
        // plus a gap, else the field's lower half hides behind the keyboard.
        bottomOffset={spacing["3xl"]}
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing.md,
          // Horizontal inset lives HERE (not on the outer View) so full-width
          // children's side shadows render inside the scroll frame instead of
          // being clipped at its edge.
          paddingHorizontal: layout.screenPadding,
          // The wizard owns BOTH vertical edges (hosts render no SafeAreaView
          // around it), so the scroll content itself clears the notch and the
          // home indicator — content scrolls under both edges, never clipped.
          // Under a host TopMenu (topInset=false) the bar owns the notch and
          // the step keeps only the screen-edge gap. The inset+screenPadding
          // top gap is the standard for every stepped screen (all onboarding/
          // setup steps align the progress overline to it).
          paddingTop: topInset
            ? insets.top + layout.screenPadding
            : layout.screenPadding,
          // The pinned BottomActionBar owns the bottom safe-area inset; reserve
          // its height + a clear gap so the last field never sticks to the CTA.
          paddingBottom: barHeight + spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar: a "‹ Previous" control + the progress overline as a matched
            micro/uppercase pair. With a back control (step 2+) they sit on one
            line, progress pushed right; on step 1 (no back) the progress is
            simply centered on its own. */}
        {onBack ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={onBack}
              hitSlop={12}
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
              <Ionicons
                name="chevron-back"
                size={14}
                color={color.text.tertiary}
                // Match the label's line box so both center on the same axis.
                style={{ lineHeight: 14 }}
              />
              <Text style={[microMeta, { lineHeight: 14 }]}>
                {t("previousStep")}
              </Text>
            </Pressable>
            {header}
          </View>
        ) : (
          // Step 1: centered overline (header owns its textAlign: center).
          (header ?? null)
        )}

        <View style={{ gap: spacing.xs }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[text.body, { color: color.text.secondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {children}
      </KeyboardAwareScrollView>

      {/* CTA (+ optional footer) pinned over the scroll — always reachable, the
          bar carries the top shadow while the buttons inside stay flat.
          `keyboardBehavior="hide"` fades it out while typing (stays mounted) so
          it can't cover the focused field. */}
      <BottomActionBar
        onHeightChange={setBarHeight}
        gap={spacing.xs}
        keyboardBehavior="hide"
      >
        {cta}
        {footer}
      </BottomActionBar>
    </View>
  );
}

/**
 * Field label (+ optional "(optional)" suffix handled by the caller's copy).
 * `required` appends a muted asterisk — tertiary, not danger: it marks "must be
 * filled", not an error state (red stays reserved for errors).
 */
export function FieldLabel({
  children,
  required = false,
}: {
  children: string;
  required?: boolean;
}) {
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <Text style={[text.bodyMedium, { color: color.text.primary }]}>
      {children}
      {required ? (
        <Text style={{ color: color.text.tertiary }}> *</Text>
      ) : null}
    </Text>
  );
}

/** In-form section header ("Where can people find you") — Playfair heading. */
export function SectionHeading({ children }: { children: string }) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <Text
      style={[
        text.heading,
        { color: color.text.primary, marginTop: spacing.sm },
      ]}
    >
      {children}
    </Text>
  );
}
