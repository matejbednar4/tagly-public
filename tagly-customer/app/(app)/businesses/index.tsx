import { useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BottomSheet,
  BusinessPreview,
  CustomButton,
  makeOffsetFetcher,
  PaginatedList,
  pressFeedbackStyle,
  TopMenu,
  useCatalogLocalizer,
  useCurrentLocation,
  useTheme,
} from "@tagly/client";
import { verticals } from "@tagly/models/shared";
import type {
  BusinessListSort,
  BusinessPublicPreview,
  GetAllBusinessesBody,
} from "@tagly/models/v2/customerApp";
import { getAllBusinesses } from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * Browse-all-businesses screen — the paginated directory behind the Discover
 * shelves (pushed from Discover's "Browse all"). The screen owns only its
 * filter/sort UI (the market note, sort pills, multi-select vertical chips); the
 * shared `PaginatedList` handles fetch/append/loading/empty/end + refetch when
 * the `query` changes.
 */
export default function BrowseBusinessesScreen() {
  const { t } = useTranslation("browseBusinesses");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { customer } = useCustomer();
  const { currentLocation } = useCurrentLocation();
  const { verticalName } = useCatalogLocalizer();

  // The directory is market-scoped (same as search/recommended) — name the market
  // so it's clear why a business elsewhere isn't listed. Only US + CZ are
  // supported locales; default to US copy until the customer loads.
  const marketName = customer?.locale === "CZ" ? t("marketCZ") : t("marketUS");

  const currentLat = currentLocation?.latitude;
  const currentLon = currentLocation?.longitude;
  const previewLocation =
    currentLat !== undefined && currentLon !== undefined
      ? { lat: currentLat, lon: currentLon }
      : undefined;
  const hasLocation = previewLocation !== undefined;

  const [sort, setSort] = useState<BusinessListSort>(
    hasLocation ? "distance" : "name",
  );
  // `selectedVerticals` is the APPLIED filter (drives the query → a fetch);
  // `draftVerticals` is the in-sheet selection that only applies on close — so
  // toggling chips doesn't refetch on every tap (which was hitting rate limits).
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [draftVerticals, setDraftVerticals] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Only the APPLIED filter feeds the query PaginatedList watches; it refetches
  // page 0 when this changes. Sort flips inline (one tap = one fetch);
  // categories batch in the sheet and apply once.
  const query: Omit<GetAllBusinessesBody, "offset"> = {
    limit: 20,
    sort,
    verticalSlugs: selectedVerticals.length > 0 ? selectedVerticals : undefined,
    currentLat,
    currentLon,
  };

  const openFilter = () => {
    setDraftVerticals(selectedVerticals);
    setFilterOpen(true);
  };
  const toggleDraft = (slug: string) =>
    setDraftVerticals((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  // Apply on close (Done OR dismiss): commit the draft → query changes → one
  // refetch. A no-op when the draft matches the applied set.
  const applyFilter = () => {
    setSelectedVerticals(draftVerticals);
    setFilterOpen(false);
  };

  const chipVerticals = useMemo(
    () => verticals.filter((v) => v.slug !== "other"),
    [],
  );
  const cardWidth = width - layout.screenPadding * 2;
  const hasFilter = selectedVerticals.length > 0;

  const Pill = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          backgroundColor: active ? color.ink : color.surface,
          borderRadius: radius.pill,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          boxShadow: active ? undefined : shadow.chip,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Text
        selectable={false}
        style={[
          text.label,
          { color: active ? color.on.ink : color.text.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>

      {customer && (
        <Text style={[text.caption, { color: color.text.tertiary }]}>
          {t("marketNote", { market: marketName })}
        </Text>
      )}

      {/* Sort */}
      {hasLocation && (
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.bodyMedium, { color: color.text.primary }]}>
            {t("sortBy")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pill
              label={t("sortName")}
              active={sort === "name"}
              onPress={() => setSort("name")}
            />
            <Pill
              label={t("sortDistance")}
              active={sort === "distance"}
              onPress={() => setSort("distance")}
            />
          </View>
        </View>
      )}

      {/* Categories open in a bottom sheet — a filter trigger (icon + chevron),
          not a plain chip, so it reads as "tap to choose". We only refetch once
          the sheet is applied (Done/close), not on every chip toggle. */}
      <Pressable
        onPress={openFilter}
        hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            alignSelf: "flex-start",
            backgroundColor: hasFilter ? color.ink : color.surface,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            boxShadow: hasFilter ? undefined : shadow.chip,
          },
          pressFeedbackStyle({ pressed, hovered }),
        ]}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={hasFilter ? color.on.ink : color.text.primary}
        />
        <Text
          style={[
            text.label,
            { color: hasFilter ? color.on.ink : color.text.primary },
          ]}
        >
          {hasFilter
            ? t("selectedCount", { count: selectedVerticals.length })
            : t("chooseCategories")}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={hasFilter ? color.on.ink : color.text.tertiary}
        />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      <PaginatedList<BusinessPublicPreview, GetAllBusinessesBody>
        router={router}
        query={query}
        fetchPage={makeOffsetFetcher(getAllBusinesses, (r) => r.businesses)}
        ListHeaderComponent={header}
        emptyHeading={t("empty")}
        emptySubheading={t("emptyHint")}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <BusinessPreview
              business={item}
              width={cardWidth}
              currentLocation={previewLocation}
            />
          </View>
        )}
      />

      {/* Category filter sheet — multi-select draft; applies on Done/close, so
          the list refetches once instead of on every chip toggle. */}
      <BottomSheet open={filterOpen} onClose={applyFilter}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("categories")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginTop: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          {chipVerticals.map((v) => (
            <Pill
              key={v.slug}
              label={verticalName(v.slug)}
              active={draftVerticals.includes(v.slug)}
              onPress={() => toggleDraft(v.slug)}
            />
          ))}
        </View>
        <CustomButton
          type="primary"
          label={t("filterDone")}
          onPress={applyFilter}
        />
      </BottomSheet>
    </View>
  );
}
