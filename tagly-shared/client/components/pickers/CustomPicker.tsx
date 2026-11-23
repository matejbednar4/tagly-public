import {
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
  Text,
  FlatList,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { BottomSheet } from "../overlays/BottomSheet";
import { CustomTextInput } from "../primitives/CustomTextInput";
import { CustomButton } from "../primitives/CustomButton";
import { withAlpha } from "../../theme/colorUtils";

export type PickerItem<T extends string | number = string | number> = {
  value: T;
  label: string;
};

/**
 * Imperative handle for opening the picker from outside — e.g. a form that
 * chains keyboard "next" from a text field into a picker. Passed via the
 * `pickerRef` prop (a plain prop, not forwardRef, so the component keeps its
 * generic signature).
 */
export type CustomPickerHandle = { open: () => void };

type SingleProps<T extends string | number> = {
  multiple?: false;
  value: T | null;
  setValue: (value: T | null) => void;
};

type MultiProps<T extends string | number> = {
  multiple: true;
  value: T[];
  setValue: (value: T[]) => void;
  /** Cap the number of selectable items (unselected rows dim once reached). */
  maxItems?: number;
};

type CommonProps<T extends string | number> = {
  items: PickerItem<T>[];
  placeholder?: string;
  /** Title shown at the top of the sheet. */
  heading?: string;
  /** Show a filter input above the list (useful for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Content rendered between the search field and the list (e.g. filter chips). */
  belowSearchContent?: ReactNode;
  /** Keep the given item order instead of the default A→Z sort by label. */
  preserveOrder?: boolean;
  /**
   * Resolve a value's chip label. Falls back to the matching `items` label, then
   * the raw value. Needed when `items` is filtered (e.g. by a vertical) so a
   * selected value outside the current filter still renders with its real label.
   */
  getLabel?: (value: T) => string;
  /**
   * Multi-select only: label for the confirm button shown once something is
   * selected (so users don't think tapping the backdrop discards their picks).
   * Defaults to "Done".
   */
  confirmLabel?: string;
  disabled?: boolean;
  /** See {@link CustomPickerHandle} — lets a parent open the sheet imperatively. */
  pickerRef?: Ref<CustomPickerHandle>;
};

type CustomPickerProps<T extends string | number> = CommonProps<T> &
  (SingleProps<T> | MultiProps<T>);

/**
 * On-brand select. The trigger is a (non-editable) {@link CustomTextInput} shell
 * so it matches text fields; tapping it opens a {@link BottomSheet} (which owns
 * the animation, backdrop, keyboard handling, and max-height cap). The current
 * selection(s) render as removable color chips **inside** the trigger over the
 * text area (single and multi), horizontally scrollable, each tappable to
 * deselect; the chevron's reserved right slot stays tappable to open. The list
 * has a fixed height (constant while searching) but flexShrinks under the
 * keyboard. Single-select picks + closes; multi-select toggles live and confirms
 * via a Done button (or the backdrop). Items sort A→Z by label unless `preserveOrder`.
 */
export function CustomPicker<T extends string | number = string | number>(
  props: CustomPickerProps<T>,
) {
  const {
    items,
    placeholder,
    heading,
    searchable = false,
    searchPlaceholder,
    belowSearchContent,
    preserveOrder = false,
    getLabel,
    confirmLabel = "Done",
    disabled,
    pickerRef,
  } = props;
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Keyboard-flow chaining: a form can open the sheet without a tap (e.g. the
  // previous text field's "next" key). Dismiss the keyboard first so the sheet
  // doesn't land on top of it.
  useImperativeHandle(pickerRef, () => ({
    open: () => {
      if (disabled) return;
      Keyboard.dismiss();
      setOpen(true);
    },
  }));

  // Constant list height (no shrinking by result count); capped + shrinks under
  // the keyboard via flexShrink inside BottomSheet's max height.
  const listHeight = Math.min(280, Math.round(screenH * 0.32));

  const isMulti = props.multiple === true;
  const maxItems = isMulti ? (props.maxItems ?? Infinity) : Infinity;

  const selectedValues: T[] = isMulti
    ? ((props.value as T[]) ?? [])
    : props.value != null
      ? [props.value as T]
      : [];

  // Selected values render as removable color chips inside the trigger (single
  // and multi). Labels resolve via `getLabel` first (so a value outside the
  // current `items` filter still labels correctly), then `items`, then raw value.
  const showChips = selectedValues.length > 0;
  const labelFor = (val: T) =>
    getLabel?.(val) ?? items.find((i) => i.value === val)?.label ?? String(val);

  // Alternating brand/accent chip fills (the "chosen tags" pattern).
  const chipBg = (i: number) => (i % 2 === 0 ? color.brand : color.accent);
  const chipFg = (i: number) =>
    i % 2 === 0 ? color.on.brand : color.on.accent;

  // Remove a chip → deselect that value (multi: drop from the array; single: null).
  const removeChip = (val: T) => {
    if (props.multiple) {
      props.setValue((props.value ?? []).filter((v) => v !== val));
    } else {
      props.setValue(null);
    }
  };

  const visibleItems = useMemo(() => {
    const base =
      searchable && query.trim()
        ? items.filter((i) =>
            i.label.toLowerCase().includes(query.trim().toLowerCase()),
          )
        : items;
    if (preserveOrder) return base;
    return [...base].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [items, searchable, query, preserveOrder]);

  const atMax = isMulti && selectedValues.length >= maxItems;
  // Multi-select shows a confirm button below the list; that button carries the
  // bottom inset, so the list only needs a small gap. Otherwise the list is the
  // last thing before the sheet edge and clears the home indicator itself.
  const showConfirm = isMulti && selectedValues.length > 0;

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setQuery("");
  };

  const toggle = (val: T) => {
    if (props.multiple) {
      const cur = props.value ?? [];
      if (cur.includes(val)) props.setValue(cur.filter((v) => v !== val));
      else if (cur.length < maxItems) props.setValue([...cur, val]);
      // multi keeps the sheet open; dismiss via the backdrop
    } else {
      props.setValue(val);
      close();
    }
  };

  return (
    <>
      {/* Trigger: a read-only CustomTextInput shell (pointerEvents off so a tap
          opens the sheet) — `focused={open}` gives it the input's ink-border +
          bumped-shadow look, and the chevron rotates. Selections render as
          removable color chips OVER the field's text area, horizontally
          scrollable; the chevron's reserved right slot stays uncovered so tapping
          it opens the sheet. */}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={{ position: "relative" }}
      >
        <View pointerEvents="none">
          <CustomTextInput
            editable={false}
            value=""
            placeholder={showChips ? "" : (placeholder ?? "Select")}
            focused={open}
            rightElement={
              <AnimatedChevron
                open={open}
                color={open ? color.ink : color.text.tertiary}
              />
            }
          />
        </View>

        {showChips ? (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              // Leave the chevron's reserved slot (CustomTextInput pads its right
              // by 40 for a right element) uncovered, so tapping there opens.
              right: 40,
              justifyContent: "center",
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                alignItems: "center",
                gap: spacing.xs,
                // Match the field's text inset (CustomTextInput pads 12 left).
                paddingHorizontal: 12,
              }}
            >
              {selectedValues.map((val, i) => (
                <Pressable
                  key={String(val)}
                  onPress={() => removeChip(val)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    height: 34,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    backgroundColor: chipBg(i),
                    boxShadow: theme.shadow.chip,
                  }}
                >
                  <Text style={[text.label, { color: chipFg(i) }]}>
                    {labelFor(val)}
                  </Text>
                  <Ionicons name="close" size={14} color={chipFg(i)} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Pressable>

      <BottomSheet open={open} onClose={close} ownsScroll>
        {/* flexShrink so this content can shrink within BottomSheet's max height
            (the list is the only flexShrink child, so it's what gives). */}
        <View style={{ gap: spacing.md, flexShrink: 1 }}>
          {heading ? (
            <Text style={[text.title, { color: color.text.primary }]}>
              {heading}
            </Text>
          ) : null}

          {searchable ? (
            <CustomTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder ?? "Search…"}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              rightIconName={query ? "close" : undefined}
              onRightIconPress={() => setQuery("")}
            />
          ) : null}

          {belowSearchContent}

          {/* Fixed-height body so the sheet never resizes when the confirm
              button appears — the button takes its space from the list (which
              flex-fills the rest), not by growing the sheet. flexShrink lets the
              whole body shrink under the keyboard. */}
          <View style={{ height: listHeight, flexShrink: 1 }}>
            <FlatList
              data={visibleItems}
              keyExtractor={(i) => String(i.value)}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              // Clear the home indicator so the last option isn't flush to the
              // screen edge (the sheet sits at the bottom). With the confirm
              // button present it owns that inset, so the list keeps a small gap.
              contentContainerStyle={{
                paddingBottom: showConfirm ? spacing.sm : insets.bottom,
              }}
              ItemSeparatorComponent={() => (
                <View
                  style={{ height: 1, backgroundColor: color.border.divider }}
                />
              )}
              renderItem={({ item }) => {
                const selected = selectedValues.includes(item.value);
                const dim = isMulti && !selected && atMax;
                return (
                  <Pressable
                    // No `disabled` prop: a disabled Pressable swallows the touch
                    // and blocks the list from scrolling when you drag over it,
                    // so guard the press instead — dimmed rows still scroll.
                    onPress={() => {
                      if (!dim) toggle(item.value);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.sm,
                      opacity: dim ? 0.4 : 1,
                      // Selected rows fill with accent (the doc's "selected
                      // state" color) — clear at a glance, not just the tick.
                      backgroundColor: selected
                        ? withAlpha(color.ink, 0.06)
                        : "transparent",
                    }}
                  >
                    <Text
                      style={[
                        selected ? text.bodyMedium : text.body,
                        {
                          flex: 1,
                          color: color.text.primary,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={color.ink} />
                    ) : null}
                  </Pressable>
                );
              }}
            />

            {/* Multi-select: an explicit confirm so users don't think tapping
                the backdrop discards their picks. It takes space from the list
                (the body height is fixed, so the sheet doesn't grow) and carries
                the bottom inset to clear the home indicator. */}
            {showConfirm ? (
              <View
                style={{ paddingTop: spacing.md, paddingBottom: insets.bottom }}
              >
                <CustomButton
                  type="primary"
                  label={confirmLabel}
                  onPress={close}
                />
              </View>
            ) : null}
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

/** Chevron that rotates 0 ↔ 180° as the picker opens/closes. */
function AnimatedChevron({ open, color }: { open: boolean; color: string }) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={20} color={color} />
    </Animated.View>
  );
}
