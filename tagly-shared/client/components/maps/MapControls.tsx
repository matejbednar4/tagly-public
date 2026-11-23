import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { LayoutAnimation, Text, TouchableOpacity, View } from "react-native";
import type { Region } from "react-native-maps";
import type { SupportedLocale } from "@tagly/models/shared";
import { useCatalogLocalizer } from "../../i18n/useCatalogLocalizer";
import { useCurrentLocation } from "../../contexts/CurrentLocationContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
import { spacing, layout } from "../../theme/theme";
import { BottomSheet } from "../overlays/BottomSheet";
import { CustomButton } from "../primitives/CustomButton";
import { openAppSettingsAlert } from "../../services/permissions/openAppSettingsAlert";
import { getMarketRegion } from "../../utils/geo/marketRegions";

/**
 * Floating map controls — top-left anchor.
 *
 * A vertical icon pill on the LEFT with two controls:
 *   - Filter (top): opens a bottom sheet of business-type chips. Multi-select —
 *     pick any number of types; the map shows businesses of the selected types
 *     (none selected = all). The pill shows the count (or the single type name).
 *   - Compass (bottom): a top-aligned "Center at…" card — both the home-market
 *     city jump and "my location" are always offered; tapping "my location"
 *     without a fix prompts to enable location in Settings.
 *
 * Search was removed — discovery/search now lives on the Discover tab.
 *
 * Reusable design-system component: reads the shared location context; the
 * home-market `locale` (which picks the city) is injected by the caller.
 */

const ICON_SIZE = 40;

interface MapControlsProps {
  /** Slugs of the business types currently visible on the map. */
  availableTypeSlugs: string[];
  /** Slugs of the currently-active type filters (empty = all). */
  selectedTypeSlugs: string[];
  setSelectedTypeSlugs: (slugs: string[]) => void;
  onCenterOnUser: () => void;
  onAnimateTo: (region: Region) => void;
  /**
   * Customer's home-market locale (US → Tampa, CZ/unset → Praha) for the "Center at"
   * city jump. Injected by the caller — NOT the UI language (a CZ customer using
   * English still belongs to the CZ market).
   */
  locale?: SupportedLocale;
  topOffset?: number;
}

export function MapControls({
  availableTypeSlugs,
  selectedTypeSlugs,
  setSelectedTypeSlugs,
  onCenterOnUser,
  onAnimateTo,
  locale,
  topOffset = spacing.xl,
}: MapControlsProps) {
  const { t } = useTranslation("map");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  const { typeName } = useCatalogLocalizer();
  const { currentLocation } = useCurrentLocation();
  // Mirrors getMarketRegion: US → Tampa, everything else (CZ + unset) → Praha —
  // the label must always name the city the jump actually targets.
  const isUS = locale === "US";
  // "My location" is always offered; with a fix it centers, without one it
  // prompts to enable location in Settings.
  const hasLocation = !!currentLocation;

  const [filterOpen, setFilterOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

  const filterCount = selectedTypeSlugs.length;
  const filterActive = filterCount > 0;

  const PILL_V_PAD = spacing.md; // 12
  const PILL_H_PAD = spacing.md; // 12
  const PILL_WIDTH = ICON_SIZE + PILL_H_PAD * 2; // 64

  // Match MapMarkerComponent's cards: cream fill + structure radius + card shadow
  // (not white/float), so the controls read as the same surface family.
  const cardStyle = {
    backgroundColor: color.surface,
    boxShadow: shadow.card,
  };
  const iconStyle = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  };
  const dividerStyle = {
    height: 1,
    alignSelf: "stretch" as const,
    backgroundColor: color.border.divider,
    marginVertical: 2,
  };

  const toggleCompass = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCompassOpen((v) => !v);
  };
  const closeCompass = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCompassOpen(false);
  };

  // Toggle a type in/out of the multi-select. "All" clears.
  const toggleType = (slug: string) =>
    setSelectedTypeSlugs(
      selectedTypeSlugs.includes(slug)
        ? selectedTypeSlugs.filter((s) => s !== slug)
        : [...selectedTypeSlugs, slug],
    );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: layout.screenPadding + topOffset,
        left: layout.screenPadding,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        {/* ── Icon pill: filter (top) + compass (bottom) ── */}
        <View
          style={{
            ...cardStyle,
            width: PILL_WIDTH,
            borderRadius: radius.structure,
            paddingVertical: PILL_V_PAD,
            paddingHorizontal: PILL_H_PAD,
          }}
        >
          {/* Filter → bottom sheet. Active count (or single type) under the icon. */}
          <TouchableOpacity
            style={[
              iconStyle,
              filterActive
                ? { height: "auto", minHeight: ICON_SIZE, paddingVertical: 4 }
                : null,
            ]}
            onPress={() => setFilterOpen(true)}
          >
            <Ionicons
              name={filterActive ? "filter" : "filter-outline"}
              size={20}
              color={color.text.primary}
            />
            {filterActive && (
              <Text
                style={[
                  text.micro,
                  {
                    color: color.ink,
                    fontSize: 9,
                    textAlign: "center",
                    marginTop: 2,
                    maxWidth: ICON_SIZE,
                  },
                ]}
                numberOfLines={1}
              >
                {filterCount === 1
                  ? typeName(selectedTypeSlugs[0])
                  : String(filterCount)}
              </Text>
            )}
          </TouchableOpacity>

          <View style={dividerStyle} />

          {/* Compass → inline "Center at…" card. */}
          <TouchableOpacity style={iconStyle} onPress={toggleCompass}>
            <Ionicons
              name={compassOpen ? "compass" : "compass-outline"}
              size={20}
              color={color.text.primary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Compass card — top-aligned with the pill. City jump is always
            available; "my location" is appended only when a fix exists. ── */}
        {compassOpen && (
          <View style={[cardStyle, { borderRadius: radius.structure }]}>
            <View
              style={{ borderRadius: radius.structure, overflow: "hidden" }}
            >
              <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={[text.label, { color: color.text.primary }]}>
                  {t("compassCenterAt")}
                </Text>
              </View>

              <View style={dividerStyle} />

              <CompassRow
                icon="business-outline"
                label={isUS ? t("compassTampaDowntown") : t("compassPraha")}
                onPress={() => {
                  onAnimateTo(getMarketRegion(locale));
                  closeCompass();
                }}
              />

              <View style={dividerStyle} />

              {/* Always offered. With a fix it centers; without one it explains
                  location is off and deep-links to Settings. */}
              <CompassRow
                icon="locate-outline"
                label={t("compassMyLocation")}
                onPress={() => {
                  if (hasLocation) {
                    onCenterOnUser();
                  } else {
                    openAppSettingsAlert({
                      title: t("locationDeniedTitle"),
                      message: t("locationDeniedMessage"),
                      settingsLabel: t("openSettings"),
                      cancelLabel: t("cancel"),
                    });
                  }
                  closeCompass();
                }}
              />
            </View>
          </View>
        )}
      </View>

      {/* ── Filter bottom sheet (multi-select) ── */}
      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("filterTitle")}
        </Text>
        {availableTypeSlugs.length === 0 ? (
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("filterNoBusinesses")}
          </Text>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              <FilterChip
                label={t("filterAll")}
                active={filterCount === 0}
                onPress={() => setSelectedTypeSlugs([])}
              />
              {availableTypeSlugs.map((slug) => (
                <FilterChip
                  key={slug}
                  label={typeName(slug)}
                  active={selectedTypeSlugs.includes(slug)}
                  onPress={() => toggleType(slug)}
                />
              ))}
            </View>
            <CustomButton
              type="primary"
              label={t("filterDone")}
              onPress={() => setFilterOpen(false)}
            />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

/** A "Center at…" row: leading icon + label, balanced padding. */
function CompassRow({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Ionicons name={icon} size={16} color={color.text.primary} />
      <Text style={[text.label, { color: color.text.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * A filter category chip. Selected = ink fill + on.ink text; unselected = white
 * surface + chip shadow (the design's selected/unselected pattern). Sized for a
 * comfortable tap target inside the sheet.
 */
function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        backgroundColor: active ? color.ink : color.surface,
        boxShadow: active ? undefined : shadow.chip,
      }}
    >
      <Text
        style={[
          text.label,
          { color: active ? color.on.ink : color.text.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
