import { Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BusinessPreview,
  makeOffsetFetcher,
  PaginatedList,
  TopMenu,
  useCurrentLocation,
  useFormatBudget,
  useTheme,
} from "@tagly/client";
import { getVisitedBusinesses } from "@tagly/sdk/v2/customerApp";
import type {
  GetVisitedBusinessesBody,
  VisitedBusinessPreview,
} from "@tagly/models/v2/customerApp";

const PAGE_LIMIT = 12;

/**
 * Shared-places screen — the paginated list of businesses the customer has shared
 * at (most-recently-visited first). Each row is the standard `BusinessPreview`
 * with the customer's per-business history (times shared + total earned) shown
 * beneath it. Reached from the Account hub's "Places shared" stat.
 *
 * Mirrors the browse-all-businesses / shares screens: the shared `PaginatedList`
 * handles fetch/append/loading/empty/end via
 * `makeOffsetFetcher(getVisitedBusinesses, r => r.businesses)`.
 */
export default function VisitedScreen() {
  const { t } = useTranslation("visited");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const { width } = useWindowDimensions();
  const formatBudget = useFormatBudget();

  const { currentLocation } = useCurrentLocation();
  const previewLocation =
    currentLocation?.latitude !== undefined &&
    currentLocation?.longitude !== undefined
      ? { lat: currentLocation.latitude, lon: currentLocation.longitude }
      : undefined;

  const query: Omit<GetVisitedBusinessesBody, "offset"> = {
    limit: PAGE_LIMIT,
  };

  const cardWidth = width - layout.screenPadding * 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      <PaginatedList<VisitedBusinessPreview, GetVisitedBusinessesBody>
        router={router}
        query={query}
        fetchPage={makeOffsetFetcher(getVisitedBusinesses, (r) => r.businesses)}
        keyExtractor={(v) => v.business.uid}
        emptyHeading={t("empty")}
        emptySubheading={t("emptyHint")}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.lg }}>
            <BusinessPreview
              business={item.business}
              width={cardWidth}
              currentLocation={previewLocation}
            />
            {/* The customer's history with this business, beneath the preview. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing.sm,
                paddingHorizontal: spacing.xs,
              }}
            >
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("visits", { count: item.visitsCount })}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: spacing.xs,
                }}
              >
                <Text style={[text.micro, { color: color.text.tertiary }]}>
                  {t("earned")}
                </Text>
                <Text style={[text.amountSm, { color: color.success }]}>
                  {formatBudget(item.totalEarnedCents)}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
