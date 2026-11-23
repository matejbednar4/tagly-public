import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useIsFocused, useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  BusinessPreview,
  businessPreviewHeight,
  callAuthed,
  CustomButton,
  CustomTextInput,
  HorizontalSnapList,
  LocationPermissionNotice,
  NoticeStack,
  RewardEstimatePendingNotice,
  SectionHeader,
  TopMenu,
  useCooldown,
  useCurrentLocation,
  useNavBottomPadding,
  useTheme,
  ZoomOnFocus,
} from "@tagly/client";
import type { ReactNode } from "react";
import {
  getBusinessesFromSearch,
  getMostPayingBusinesses,
  getNearestBusinesses,
  getRecommendedBusinesses,
} from "@tagly/sdk/v2/customerApp";
import type { BusinessPublicPreview } from "@tagly/models/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";

/**
 * Discover tab — a personalized browse surface that complements the spatial map.
 *
 * Two modes:
 *  • Browse (default): vertical scroll of horizontal "shelves" — "Recommended for
 *    you" (interests ∪ shared verticals, nearest-first) and "Earn the most"
 *    (highest reward near the customer's audience locations). Empty shelves
 *    auto-hide; the top-earning shelf only shows once a snapshot exists.
 *  • Results: a search query (≥2 chars) switches the feed to a single vertical
 *    list via the name-search endpoint. (Category browse is intentionally out of
 *    scope for v1 — see the Discover plan; revisit once the catalog is dense.)
 *
 * While the customer is connected to Instagram but their audience snapshot hasn't
 * been taken yet (`instagram.hasSnapshot === false`), rewards come back null and a
 * shared "calculating your rewards" notice sits at the top (the per-card price
 * slot shows the calculating indicator). `_layout` polls + flips the flag, which
 * re-renders this screen with real rewards once ready.
 *
 * Fetching is gated on `useIsFocused()`: the tab stays mounted after its first
 * visit, so without the gate the shelves would refetch in the background from
 * Map/Account. A per-shelf "last fetched key" then makes re-focus a no-op unless
 * the inputs actually changed — returning to the tab with the same location /
 * estimate / snapshot reuses the loaded shelves instead of refetching them.
 * The key is committed ONLY on a successful fetch (E042): a failure keeps any
 * stale data and leaves the key un-burned, so re-focusing retries instead of
 * pinning "no businesses" for the session. Pull-to-refresh (shared 30s
 * `useCooldown`, stories-picker shape) bumps a nonce that rides every fetch
 * key, re-running all loads on demand.
 * Coordinates are also rounded to ~11m before being used as the fetch key, so
 * raw GPS jitter (and the cached→fresh position handoff) doesn't retrigger every
 * shelf on sub-meter noise.
 */

/** Capped lists, so a debounce keeps search from firing on every keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

/** Client-side throttle on pull-to-refresh (same as the stories picker). */
const REFRESH_COOLDOWN_MS = 30_000;

export default function DiscoverScreen() {
  const { t } = useTranslation("discover");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const navBottomPadding = useNavBottomPadding();

  // Tabs stay mounted after their first visit, so without this the shelves would
  // keep refetching in the background while the user is on Map/Account. Gate every
  // load on focus — nothing fires unless Discover is the visible tab.
  const isFocused = useIsFocused();

  const { customer } = useCustomer();
  const { currentLocation, permissionStatus } = useCurrentLocation();
  // Server-owned (E062) - the cached customer is the single source; changes
  // arrive via the StoryViewsModal patching setCustomer.
  const storyViews = customer?.estimatedStoryViews;

  // Not sent on the wire anymore (the pricer reads the server-owned
  // Customer.estimatedStoryViews — E062); kept in the fetch keys/deps purely as
  // a refetch trigger so a story-views change re-pulls the fresh estimates.
  const estimatedStoryViews =
    typeof storyViews === "number" ? storyViews : undefined;
  const currentLat = currentLocation?.latitude;
  const currentLon = currentLocation?.longitude;
  // The location context is { latitude, longitude }; BusinessPreview + the shelves
  // take { lat, lon }.
  const previewLocation =
    currentLat !== undefined && currentLon !== undefined
      ? { lat: currentLat, lon: currentLon }
      : undefined;

  // Coordinates used as the shelf fetch key, rounded to ~11m (4 dp). Raw GPS
  // jitter and the cached→fresh position handoff wiggle the trailing decimals on
  // every location update; keying the fetches on the raw floats refetched all
  // three shelves on sub-meter noise. 11m is far finer than the neighbourhood
  // scale these shelves rank at, so the ranking is unaffected.
  const fetchLat =
    currentLat === undefined ? undefined : Number(currentLat.toFixed(4));
  const fetchLon =
    currentLon === undefined ? undefined : Number(currentLon.toFixed(4));

  // Snapshot gating: the pending notice + whether the top-earning shelf can show.
  const hasSnapshot = customer?.instagram?.hasSnapshot === true;
  // The shelves are country-scoped server-side (every business endpoint filters
  // on `address.country_code = customer.locale`), so a region switch changes the
  // whole catalog. It rides every fetch key below — without it the burned key
  // would pin the previous country's businesses until the coords moved.
  const locale = customer?.locale;
  const snapshotPending =
    !!customer?.instagram && customer.instagram.hasSnapshot === false;

  // Floating notices at the top of the feed. Location (act-on) leads, rewards
  // (informational) follows and peeks; NoticeStack renders a lone notice plainly.
  const locationDenied = permissionStatus === "denied";
  const notices: ReactNode[] = [];
  if (locationDenied) notices.push(<LocationPermissionNotice key="location" />);
  if (snapshotPending)
    notices.push(<RewardEstimatePendingNotice key="rewards" />);

  // ── Data: browse shelves + results. All via callAuthed, which infers each
  // endpoint's success type so `result.data.businesses` stays typed. ──────────
  const [recommended, setRecommended] = useState<
    BusinessPublicPreview[] | null
  >(null);
  const [topEarning, setTopEarning] = useState<BusinessPublicPreview[] | null>(
    null,
  );
  const [nearest, setNearest] = useState<BusinessPublicPreview[] | null>(null);
  const [results, setResults] = useState<BusinessPublicPreview[] | null>(null);

  // Inputs each shelf last successfully fetched for. Returning to the tab flips
  // isFocused false→true and re-runs the effects below; without this the shelves
  // refetched identical data on every visit. We keep the isFocused gate (so a
  // location change that lands while the tab is backgrounded is picked up on
  // return) but skip the network call when the meaningful inputs — location,
  // estimate, snapshot, query — are unchanged since the last successful load. The
  // key is only committed after a non-cancelled, SUCCESSFUL fetch (E042 — a
  // committed key on a failed load pinned "no businesses" for the session), so
  // an interrupted or failed load still refetches rather than sticking.
  const lastRecommendedKey = useRef<string | null>(null);
  const lastNearestKey = useRef<string | null>(null);
  const lastTopEarningKey = useRef<string | null>(null);
  const lastSearchKey = useRef<string | null>(null);

  // ── Pull-to-refresh (E042). A failed load must never read as a successful
  // empty one: the keys above are only committed on a SUCCESSFUL fetch (see
  // each effect), so a failure leaves the key un-burned and the next focus
  // retries. The explicit escape hatch is this pull-to-refresh: `refreshNonce`
  // is part of every fetch key, so bumping it re-keys and re-runs all fetch
  // effects; the lists reset to their loading state so the spinners show.
  // Throttled by the shared client-side cooldown, same as the stories picker.
  const refreshCooldown = useCooldown(REFRESH_COOLDOWN_MS);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const onPullRefresh = useCallback(() => {
    if (refreshCooldown.active || pullRefreshing) return;
    refreshCooldown.start();
    setRecommended(null);
    setNearest(null);
    setTopEarning(null);
    setResults(null);
    setPullRefreshing(true);
    setRefreshNonce((n) => n + 1);
  }, [refreshCooldown, pullRefreshing]);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(handle);
  }, [searchText]);

  // Results mode the moment the user types (min 1 char) — not after the debounce.
  const inResultsMode = searchText.trim().length > 0;
  // Min 1 char; debouncedSearch is already trimmed ("" when empty).
  const query = debouncedSearch;
  // Show the spinner immediately: true while the debounced query is still
  // catching up to what's typed, or while the fetch for the settled query is in
  // flight. (Derived — no stuck spinner when re-typing a prior query.)
  const searchLoading =
    inResultsMode &&
    (debouncedSearch !== searchText.trim() || results === null);

  const onChangeSearch = useCallback((next: string) => setSearchText(next), []);

  useEffect(() => {
    if (!isFocused) return; // background tab — don't fetch
    const key = `${refreshNonce}|${locale}|${fetchLat}|${fetchLon}|${estimatedStoryViews}`;
    if (lastRecommendedKey.current === key) return; // unchanged — keep the data
    let cancelled = false;
    (async () => {
      const result = await callAuthed(
        router,
        (jwt) =>
          getRecommendedBusinesses({
            jwt,
            query: {
              currentLat: fetchLat,
              currentLon: fetchLon,
            },
          }),
        // Alerts on (every shelf reports honestly). customAlert de-dupes the
        // identical alert across these parallel loads, so a shared rate-limit /
        // network failure shows once, not once per shelf.
      );
      if (!cancelled) {
        if (result.ok) {
          if (result.data) setRecommended(result.data.businesses);
          lastRecommendedKey.current = key; // only a real answer burns the key
        } else {
          // Failed (timeout / 429 / server) — the alert already fired. Keep any
          // stale data, settle a loading shelf to empty, and leave the key
          // un-burned so re-focus or pull-to-refresh retries (E042).
          setRecommended((prev) => prev ?? []);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isFocused,
    router,
    locale,
    fetchLat,
    fetchLon,
    estimatedStoryViews,
    refreshNonce,
  ]);

  useEffect(() => {
    if (!isFocused) return; // background tab — don't fetch
    const key = `${refreshNonce}|${locale}|${fetchLat}|${fetchLon}|${estimatedStoryViews}`;
    if (lastNearestKey.current === key) return; // unchanged — keep the data
    // "Near you" needs the device location — no GPS permission, no shelf. We do
    // NOT fall back to audience locations (that wouldn't be "near you"). Empty
    // array → the shelf auto-hides.
    if (fetchLat === undefined || fetchLon === undefined) {
      setNearest([]);
      lastNearestKey.current = key;
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await callAuthed(router, (jwt) =>
        getNearestBusinesses({
          jwt,
          query: {
            currentLat: fetchLat,
            currentLon: fetchLon,
          },
        }),
      );
      if (!cancelled) {
        if (result.ok) {
          if (result.data) setNearest(result.data.businesses);
          lastNearestKey.current = key; // only a real answer burns the key
        } else {
          setNearest((prev) => prev ?? []); // failed — retriable, key un-burned
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isFocused,
    router,
    locale,
    fetchLat,
    fetchLon,
    estimatedStoryViews,
    refreshNonce,
  ]);

  useEffect(() => {
    if (!isFocused) return; // background tab — don't fetch
    const key = `${refreshNonce}|${locale}|${hasSnapshot}`;
    if (lastTopEarningKey.current === key) return; // unchanged — keep the data
    if (!hasSnapshot) {
      setTopEarning([]); // no snapshot → shelf hidden; don't call the endpoint
      lastTopEarningKey.current = key;
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await callAuthed(router, (jwt) =>
        getMostPayingBusinesses({ jwt, query: {} }),
      );
      if (!cancelled) {
        if (result.ok) {
          if (result.data) setTopEarning(result.data.businesses);
          lastTopEarningKey.current = key; // only a real answer burns the key
        } else {
          setTopEarning((prev) => prev ?? []); // failed — retriable, key un-burned
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, router, locale, hasSnapshot, refreshNonce]);

  useEffect(() => {
    if (!query) {
      setResults(null);
      lastSearchKey.current = null;
      return;
    }
    if (!isFocused) return; // background tab — don't fetch
    const key = `${refreshNonce}|${locale}|${query}|${fetchLat}|${fetchLon}|${estimatedStoryViews}`;
    if (lastSearchKey.current === key) return; // same query + inputs — keep results
    let cancelled = false;
    setResults(null);
    (async () => {
      const result = await callAuthed(
        router,
        (jwt) =>
          getBusinessesFromSearch({
            jwt,
            query: {
              q: query,
              currentLat: fetchLat,
              currentLon: fetchLon,
            },
          }),
        // User-initiated query — surface errors (e.g. rate limit) rather than
        // returning a silently-empty result the user can't explain.
      );
      if (!cancelled) {
        if (result.ok && result.data) {
          setResults(result.data.businesses);
          lastSearchKey.current = key; // only a real answer burns the key
        } else {
          // Failed (alert already fired) — settle the spinner but leave the key
          // un-burned, so retyping or pull-to-refresh retries (E042).
          setResults([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    query,
    isFocused,
    router,
    locale,
    fetchLat,
    fetchLon,
    estimatedStoryViews,
    refreshNonce,
  ]);

  // Collapse the pull-to-refresh spinner once every visible load has settled
  // (each fetch always settles its list — success, 304, or failure — so this
  // can't hang).
  useEffect(() => {
    if (!pullRefreshing) return;
    const settled = inResultsMode
      ? results !== null
      : recommended !== null && nearest !== null && topEarning !== null;
    if (settled) setPullRefreshing(false);
  }, [
    pullRefreshing,
    inResultsMode,
    results,
    recommended,
    nearest,
    topEarning,
  ]);

  const cardWidth = Math.min(Math.round(width * 0.72), 300);

  // All three browse shelves loaded AND empty → the market has no accessible
  // businesses (Recommended would otherwise random-backfill), so every shelf
  // self-hides. Show one empty state instead of a blank feed. While any shelf is
  // still loading (=== null), this stays false so the loading shelves show.
  const browseEmpty =
    recommended !== null &&
    recommended.length === 0 &&
    topEarning !== null &&
    topEarning.length === 0 &&
    nearest !== null &&
    nearest.length === 0;

  // Re-tapping the active Discover tab scrolls this list back to top (the nav
  // bar emits `tabPress`; the shelves register their own refs so they slide back
  // too — see DiscoverShelf).
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <ZoomOnFocus>
      <TopMenu title={t("title")} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: color.background }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Drop pull-to-refresh entirely while cooling down (and nothing's in
        // flight) so the list isn't even pullable — same shape as the stories
        // picker; keeps it active during the fetch so the spinner still shows.
        refreshControl={
          refreshCooldown.active && !pullRefreshing ? undefined : (
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={onPullRefresh}
              tintColor={color.text.tertiary}
            />
          )
        }
        contentContainerStyle={{
          paddingTop: layout.screenPadding,
          paddingBottom: navBottomPadding,
          gap: spacing.xl,
        }}
      >
        {notices.length > 0 && (
          // Full-bleed: NoticeStack applies the horizontal screen padding itself.
          <NoticeStack notices={notices} />
        )}
        {/* Search. */}
        <View style={{ paddingHorizontal: layout.screenPadding }}>
          <CustomTextInput
            placeholder={t("searchPlaceholder")}
            value={searchText}
            onChangeText={onChangeSearch}
            rightIconName={searchText.length > 0 ? "close" : "search"}
            onRightIconPress={
              searchText.length > 0 ? () => onChangeSearch("") : undefined
            }
          />
        </View>

        {inResultsMode ? (
          <ResultsList
            title={t("resultsTitle")}
            businesses={results}
            loading={searchLoading}
            currentLocation={previewLocation}
            cardWidth={width - layout.screenPadding * 2}
          />
        ) : browseEmpty ? (
          <View
            style={{
              alignItems: "center",
              gap: spacing.sm,
              paddingTop: spacing["3xl"],
              paddingHorizontal: layout.screenPadding,
            }}
          >
            <Ionicons
              name="storefront-outline"
              size={48}
              color={color.text.tertiary}
            />
            <Text
              style={[
                text.title,
                { color: color.text.primary, textAlign: "center" },
              ]}
            >
              {t("noBusinesses")}
            </Text>
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("noBusinessesHint")}
            </Text>
          </View>
        ) : (
          <>
            <DiscoverShelf
              title={t("recommendedTitle")}
              businesses={recommended}
              currentLocation={previewLocation}
              cardWidth={cardWidth}
            />
            <DiscoverShelf
              title={t("topEarningTitle")}
              businesses={topEarning}
              currentLocation={previewLocation}
              cardWidth={cardWidth}
            />
            <DiscoverShelf
              title={t("nearestTitle")}
              businesses={nearest}
              currentLocation={previewLocation}
              cardWidth={cardWidth}
            />
            <View style={{ paddingHorizontal: layout.screenPadding }}>
              <CustomButton
                type="soft"
                label={t("browseAll")}
                onPress={() => router.push("/businesses")}
                icon="list"
              />
            </View>
          </>
        )}
      </ScrollView>
    </ZoomOnFocus>
  );
}

/* ── Horizontal shelf (browse mode) ────────────────────────────────────────── */
function DiscoverShelf({
  title,
  businesses,
  currentLocation,
  cardWidth,
}: {
  title: string;
  businesses: BusinessPublicPreview[] | null;
  currentLocation: { lat: number; lon: number } | undefined;
  cardWidth: number;
}) {
  const { theme } = useTheme();
  const { color, spacing, layout } = theme;

  // Loaded + empty → hide the whole shelf (no empty titled section).
  if (businesses !== null && businesses.length === 0) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <SectionHeader
        title={title}
        style={{ paddingHorizontal: layout.screenPadding }}
      />
      {businesses === null ? (
        <View
          style={{
            height: businessPreviewHeight(cardWidth, { withButton: true }),
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <HorizontalSnapList
          data={businesses}
          cardWidth={cardWidth}
          keyExtractor={(b) => b.uid}
          renderItem={(item) => (
            <BusinessPreview
              business={item}
              width={cardWidth}
              currentLocation={currentLocation}
              showEarnButton
            />
          )}
        />
      )}
    </View>
  );
}

/* ── Single vertical list (search / chip results) ──────────────────────────── */
function ResultsList({
  title,
  businesses,
  loading,
  currentLocation,
  cardWidth,
}: {
  title: string;
  businesses: BusinessPublicPreview[] | null;
  loading?: boolean;
  currentLocation: { lat: number; lon: number } | undefined;
  cardWidth: number;
}) {
  const { t } = useTranslation("discover");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;

  return (
    <View style={{ gap: spacing.md, paddingHorizontal: layout.screenPadding }}>
      {!loading && businesses && businesses.length > 0 && (
        <SectionHeader title={title} />
      )}
      {loading || businesses === null ? (
        <View style={{ paddingVertical: spacing.xl }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : businesses.length === 0 ? (
        <View style={{ gap: spacing.xs, paddingVertical: spacing.xl }}>
          <Text style={[text.bodyMedium, { color: color.text.primary }]}>
            {t("empty")}
          </Text>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {t("emptyHint")}
          </Text>
        </View>
      ) : (
        // Capped lists (≤12), so a plain map in the parent ScrollView is fine —
        // no nested vertical virtualization.
        businesses.map((b) => (
          // No earn CTA in the vertical results list — the card opens the
          // business detail itself; the CTA lives on the browse shelves only.
          <BusinessPreview
            key={b.uid}
            business={b}
            width={cardWidth}
            currentLocation={currentLocation}
          />
        ))
      )}
    </View>
  );
}
