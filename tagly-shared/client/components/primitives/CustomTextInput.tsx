import { forwardRef, ComponentProps, ReactNode, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
  Platform,
  Pressable,
  TextStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";

type CustomTextInputProps = Omit<TextInputProps, "style"> & {
  heading?: string;
  /**
   * Optional trailing element rendered on the same row as `heading`, aligned
   * to the right (e.g. a "Forgot password?" or "Resend code" link). Has no
   * effect when `heading` is not set.
   */
  headingRight?: ReactNode;
  /**
   * Caption under the heading. Also valid **on its own**, as a field's whole
   * label where a full `heading` would carry too much weight (the billing
   * sheets' "Custom amount", which sits under the section's own question and
   * must recede below it).
   */
  subheading?: string;
  rightIconName?: ComponentProps<typeof Ionicons>["name"];
  onRightIconPress?: () => void;
  /**
   * Custom element rendered in the right slot (reserves the same right padding
   * as `rightIconName`). Used for adornments that aren't a plain pressable icon
   * — e.g. the picker's animated chevron. Ignored while `error`/`valid` show
   * their status icon.
   */
  rightElement?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style for the bordered input container */
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Style for the right icon (size and color) */
  iconStyle?: { size?: number; color?: string };
  prefix?: string;
  placeholderTextColor?: string;
  /** Optional label displayed inside the border container above the input */
  insideHeading?: string;
  /** Field height. Default 56. */
  height?: number;
  /**
   * Error message. When set, the field switches to its error state (danger
   * border + ring + alert icon) and renders this text below it. Takes priority
   * over `valid`.
   */
  error?: string;
  /**
   * Mark the field as filled-and-valid — adds a success check icon on the right
   * (ignored while `error` is set). Purely visual; validation lives in the form.
   */
  valid?: boolean;
  /**
   * Force the focused look (ink border + bumped shadow) without the field being
   * focused — for a non-editable trigger, e.g. CustomPicker reflecting its open
   * state. OR-ed with the field's own focus.
   */
  focused?: boolean;
};

/**
 * Text field with four visual states (see tagly-shared/client/CLAUDE.md → Inputs):
 *
 * - **Resting** — white fill + 1px `border.subtle` + `shadow.chip`.
 * - **Focused** — 1.5px `ink` border + an ink focus ring (no resting shadow).
 * - **Valid** — resting style + a `success` check icon on the right.
 * - **Error** — 1.5px `danger` border + a danger ring + an alert icon, with the
 *   `error` message in `caption` text below.
 *
 * Focus uses ink, never accent (accent is reserved for selection). Pass `error`
 * / `valid` to drive the state — don't restyle by hand.
 */
export const CustomTextInput = forwardRef<TextInput, CustomTextInputProps>(
  (
    {
      heading,
      headingRight,
      subheading,
      placeholder,
      rightIconName,
      onRightIconPress,
      rightElement,
      style,
      containerStyle,
      inputStyle,
      iconStyle,
      autoCorrect = false,
      prefix,
      placeholderTextColor,
      insideHeading,
      height,
      error,
      valid = false,
      focused = false,
      multiline = false,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const { color, text, radius, spacing } = theme;
    const [isFocused, setIsFocused] = useState(false);

    const hasError = !!error;
    // `focused` (a forced look, e.g. an open picker trigger) OR the field's own
    // focus both drive the focused styling.
    const showFocus = focused || isFocused;

    // State drives border color + elevation only — the border stays a hairline
    // 1px (no width change, so no layout shift). Resting is the faint border +
    // chip shadow; focus/error recolor the border (ink / danger) and bump the
    // shadow one rung (chip → card). Focus is ink, never accent.
    const borderColor = hasError
      ? color.danger
      : showFocus
        ? color.ink
        : color.border.subtle;
    const boxShadow =
      hasError || showFocus ? theme.shadow.card : theme.shadow.chip;

    // Right-side status icon: error alert wins, then a valid check. A custom
    // `rightElement` / `rightIconName` shows only when neither status icon does.
    const statusIcon = hasError
      ? { name: "alert-circle" as const, tint: color.danger }
      : valid
        ? { name: "checkmark-circle" as const, tint: color.success }
        : null;
    const hasRightSlot = !!statusIcon || !!rightElement || !!rightIconName;

    const inputHeight = height ?? 56;
    // Single-line: body font WITHOUT its lineHeight. In a fixed-height
    // single-line field a tall line box (24px for the 16px body) makes the glyph
    // sit low and appear to "jump" down on the first keystroke — the placeholder
    // ignores lineHeight but the typed value honors it. Dropping it lets the
    // field's height center the text. (Used for the prefix too, so they align.)
    //
    // Multiline: KEEP the lineHeight — wrapped lines need it to space apart and,
    // critically, so the fixed-height box scrolls its content internally instead
    // of letting later lines render past the bottom border.
    const inputTextStyle = {
      ...text.body,
      ...(multiline ? {} : { lineHeight: undefined }),
    };

    return (
      <View style={[{ width: "100%" }, style]}>
        {heading && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.xs,
            }}
          >
            <Text style={[text.label, { color: color.text.primary }]}>
              {heading}
            </Text>
            {headingRight}
          </View>
        )}
        {subheading && (
          <Text style={[text.caption, { color: color.text.tertiary }]}>
            {subheading}
          </Text>
        )}
        <View
          style={[
            {
              flexDirection: "row",
              // Multiline stretches the field so it fills the fixed box and its
              // content scrolls inside it; single-line stays vertically centered.
              alignItems: multiline ? "stretch" : "center",
              // Either label opens the same gap — a subheading-only field must
              // not sit flush against its own label.
              marginTop: heading || subheading ? spacing.xs : 0,
              height: insideHeading ? inputHeight + 16 : inputHeight,
              // Multiline: clip overflow so wrapped lines past the box scroll
              // internally instead of rendering past the border; small vertical
              // inset so text doesn't touch the top/bottom edges.
              ...(multiline
                ? { overflow: "hidden", paddingVertical: spacing.sm }
                : null),
              borderRadius: radius.structure,
              borderWidth: 1,
              borderColor,
              backgroundColor: color.surface,
              boxShadow,
            },
            containerStyle,
          ]}
        >
          {insideHeading && (
            <Text
              style={[
                text.micro,
                {
                  color: color.text.tertiary,
                  position: "absolute",
                  top: 8,
                  left: 12,
                },
              ]}
            >
              {insideHeading}
            </Text>
          )}
          {prefix && (
            <Text
              style={[
                inputTextStyle,
                {
                  color: color.ink,
                  marginLeft: 12,
                  marginTop: insideHeading ? 16 : 0,
                },
              ]}
            >
              {prefix}
            </Text>
          )}
          <TextInput
            ref={ref}
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor ?? color.text.tertiary}
            autoCorrect={autoCorrect}
            selectionColor={color.text.tertiary}
            cursorColor={color.text.tertiary}
            underlineColorAndroid="transparent"
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            style={[
              inputTextStyle,
              {
                flex: 1,
                // Multiline fills the box (height comes from the stretched
                // container) and aligns text to the top; single-line keeps its
                // fixed height + centered glyph.
                ...(multiline
                  ? { textAlignVertical: "top" as const }
                  : { height: inputHeight }),
                color: color.text.primary,
                paddingHorizontal: prefix ? 4 : 12,
                paddingRight: hasRightSlot ? 40 : 12,
                marginTop: insideHeading ? 16 : 0,
              },
              // The Android centering hack is single-line only — it would force
              // multiline text to the middle and kill top alignment.
              Platform.OS === "android" &&
                !multiline && {
                  paddingVertical: 0,
                  textAlignVertical: "center",
                  // Android adds extra font padding that throws off vertical
                  // centering; drop it so the glyph sits where the height centers it.
                  includeFontPadding: false,
                },
              inputStyle,
            ]}
            {...rest}
          />
          {/* Status icon (non-interactive) takes precedence over the custom
              pressable right icon. */}
          {statusIcon ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={statusIcon.name}
                size={20}
                color={statusIcon.tint}
              />
            </View>
          ) : rightElement ? (
            <View
              style={{
                position: "absolute",
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: "center",
              }}
            >
              {rightElement}
            </View>
          ) : rightIconName ? (
            <Pressable
              style={{
                position: "absolute",
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: "center",
              }}
              onPress={onRightIconPress}
            >
              {({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => (
                <Ionicons
                  name={rightIconName}
                  size={iconStyle?.size ?? 16}
                  color={
                    iconStyle?.color ??
                    (hovered ? color.ink : color.text.tertiary)
                  }
                  style={{ opacity: pressed ? 0.6 : 1 }}
                />
              )}
            </Pressable>
          ) : null}
        </View>
        {hasError && (
          <Text
            style={[
              text.caption,
              { color: color.on.dangerText, marginTop: spacing.xs },
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    );
  },
);
