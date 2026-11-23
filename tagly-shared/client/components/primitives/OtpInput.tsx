import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export type OtpInputHandle = {
  /** Focus the input (raises the keyboard). */
  focus: () => void;
};

type OtpInputProps = {
  value: string;
  onChangeText: (code: string) => void;
  /** Number of digits. Default 6. */
  length?: number;
  /** Fired once the code reaches `length` (typed, pasted, or OS-autofilled). */
  onComplete?: (code: string) => void;
  editable?: boolean;
};

/**
 * Segmented one-time-code input: `length` underline cells backed by a single
 * real `TextInput` stretched across them. Using one input (not N) keeps iOS
 * `oneTimeCode` / Android `sms-otp` autofill and full-code paste working — both
 * of which break with per-digit inputs. The cells are presentational; the input
 * lies on top of them and takes every touch.
 *
 * Focus is imperative (via ref) rather than `autoFocus`, so the caller can raise
 * the keyboard *after* a navigation transition finishes (autoFocus fires on
 * mount and races the slide-in).
 *
 * ## Why the input is transparent instead of hidden — don't "simplify" this
 *
 * Long-press must raise the OS edit menu ("Paste"), which is the only paste
 * route a `number-pad` keyboard has (it carries no paste key). Three earlier
 * details each broke that, so keep all three as they are:
 *
 *  - **`color: "transparent"`, not `opacity: 0`.** An alpha-0 field gives the
 *    platform no visible text geometry to anchor a selection to, so the callout
 *    never appeared. Full opacity with transparent glyphs looks identical (the
 *    cells draw the digits) while staying a real, selectable text field.
 *  - **No `caretHidden`.** It suppresses the caret rect the selection UI is
 *    positioned from, taking the edit menu with it. The caret is painted out
 *    instead — `selectionColor` (caret + selection on iOS, highlight on
 *    Android) and `cursorColor` (Android caret).
 *  - **No `Pressable` wrapper.** Its touch responder competed with the input's
 *    own long-press. The input already covers the cells, so tapping it focuses
 *    natively and the wrapper bought nothing.
 *
 * `contextMenuHidden` must stay unset (it defaults to false) — setting it true
 * disables the menu outright.
 *
 * **Android is the one exception to "transparent glyphs":** some keyboards
 * (Samsung Keyboard at least) paint the composing text with their own
 * foreground span, overriding `color: "transparent"` — the raw code rendered
 * in black on top of the cells. There the whole overlay fades out via a
 * near-zero `opacity` instead, which hides the glyphs at the layer level no
 * matter what the IME paints. Android's long-press edit toolbar and selection
 * handles are separate system windows, so they survive the fade; the iOS
 * styling (where alpha-0 DID kill the callout) is untouched.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(
  function OtpInput(
    { value, onChangeText, length = 6, onComplete, editable = true },
    ref,
  ) {
    const { theme } = useTheme();
    const { color, text, radius } = theme;
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const handleChange = (raw: string) => {
      // Also normalizes what a paste drags in (spaces, "Your code is 123456.")
      // down to just the digits, so the system menu needs no special-casing.
      const digits = raw.replace(/\D/g, "").slice(0, length);
      onChangeText(digits);
      if (digits.length === length) onComplete?.(digits);
    };

    return (
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? "";
          // Highlight the next empty cell (or the last cell once full) while focused.
          const isActive =
            focused &&
            (i === value.length ||
              (value.length === length && i === length - 1));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 56,
                borderRadius: radius.structure,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color.surface,
                boxShadow: theme.shadow.card,
                borderWidth: isActive ? 1 : undefined,
                borderColor: color.accent,
                borderBottomWidth: 3,
              }}
            >
              <Text
                style={[
                  text.bodyMedium,
                  { fontSize: 30, lineHeight: 36, color: color.text.primary },
                ]}
              >
                {char}
              </Text>
            </View>
          );
        })}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          editable={editable}
          // Caret and selection are painted out rather than disabled (see the
          // docblock) so the field stays fully interactive and long-press can
          // raise the system "Paste" menu.
          selectionColor="transparent"
          cursorColor="transparent"
          // A real (not alpha-0) overlay across the cells: it takes every touch,
          // and its own glyphs are invisible so only the cells' digits show.
          style={[
            StyleSheet.absoluteFill,
            { color: "transparent", textAlign: "center", fontSize: 30 },
            // Android-only (see the docblock): IME composing spans can repaint
            // the "transparent" glyphs, so hide the layer itself instead.
            Platform.OS === "android" && { opacity: 0.01 },
          ]}
        />
      </View>
    );
  },
);
