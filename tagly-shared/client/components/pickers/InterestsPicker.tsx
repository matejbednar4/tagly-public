import { useMemo, useState, type Ref } from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { customerInterests, verticals } from "@tagly/models/shared";
import { useCatalogLocalizer } from "../../i18n/useCatalogLocalizer";
import { useTheme } from "../../theme/ThemeProvider";
import {
  CustomPicker,
  type PickerItem,
  type CustomPickerHandle,
} from "./CustomPicker";

type InterestsPickerProps = {
  /** Selected interest slugs. */
  value: string[];
  setValue: (slugs: string[]) => void;
  maxItems?: number;
  placeholder?: string;
  heading?: string;
  searchPlaceholder?: string;
  /** Label for the "all verticals" filter chip. */
  allLabel: string;
  /** Label for the sheet's confirm button (shown once something is selected). */
  doneLabel: string;
  disabled?: boolean;
  /** Opens the sheet imperatively (e.g. chained from a form's keyboard flow). */
  pickerRef?: Ref<CustomPickerHandle>;
};

const ALL = "ALL";

/**
 * Interest multi-select over the static `@tagly/models` catalog (the v2/new-theme
 * successor to the old `InterestsSelector`). Per-vertical filter chips sit above
 * the list inside the sheet; selections render as removable color chips **inside
 * the trigger** (handled by `CustomPicker`). Names localize via
 * `useCatalogLocalizer` (passed as `getLabel` so chips label correctly even when
 * the list is filtered to another vertical); values are interest **slugs**.
 */
export function InterestsPicker({
  value,
  setValue,
  maxItems,
  placeholder,
  heading,
  searchPlaceholder,
  allLabel,
  doneLabel,
  disabled,
  pickerRef,
}: InterestsPickerProps) {
  const { theme } = useTheme();
  const { color, text, spacing, radius, layout } = theme;
  const { interestName, verticalName } = useCatalogLocalizer();

  const [activeVertical, setActiveVertical] = useState<string>(ALL);

  // Only verticals that actually have interests get a chip.
  const verticalChips = useMemo(() => {
    const withInterests = verticals.filter((v) =>
      customerInterests.some((i) => i.verticalSlugs.includes(v.slug)),
    );
    return [
      { slug: ALL, label: allLabel },
      ...withInterests.map((v) => ({
        slug: v.slug,
        label: verticalName(v.slug),
      })),
    ];
  }, [allLabel, verticalName]);

  const interestItems: PickerItem<string>[] = useMemo(() => {
    const pool =
      activeVertical === ALL
        ? customerInterests
        : customerInterests.filter((i) =>
            i.verticalSlugs.includes(activeVertical),
          );
    return pool.map((i) => ({ value: i.slug, label: interestName(i.slug) }));
  }, [activeVertical, interestName]);

  // Full-bleed filter chips (break out of the sheet's horizontal padding).
  const filterChips = (
    <View style={{ height: 40, marginHorizontal: -layout.screenPadding }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: layout.screenPadding,
          alignItems: "center",
        }}
      >
        {verticalChips.map((c) => {
          const active = c.slug === activeVertical;
          return (
            <Pressable
              key={c.slug}
              onPress={() => setActiveVertical(c.slug)}
              style={{
                height: 32,
                paddingHorizontal: spacing.md,
                justifyContent: "center",
                borderRadius: radius.pill,
                backgroundColor: active ? color.ink : color.surface,
                boxShadow: theme.shadow.chip,
              }}
            >
              <Text
                style={[
                  text.label,
                  { color: active ? color.on.ink : color.text.primary },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <CustomPicker<string>
      multiple
      maxItems={maxItems}
      items={interestItems}
      value={value}
      setValue={setValue}
      placeholder={placeholder}
      heading={heading}
      searchable
      searchPlaceholder={searchPlaceholder}
      belowSearchContent={filterChips}
      getLabel={interestName}
      confirmLabel={doneLabel}
      disabled={disabled}
      pickerRef={pickerRef}
    />
  );
}
