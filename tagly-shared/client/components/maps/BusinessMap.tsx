import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { MapControls } from "./MapControls";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Platform,
  View,
  Text,
  ViewStyle,
  StyleProp,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { debounce } from "lodash";
import { useRouter, type Href } from "expo-router";
import { callAuthed } from "../../api/caller";
import { useCurrentLocation } from "../../contexts/CurrentLocationContext";
import {
  BusinessPreview,
  businessPreviewHeight,
} from "../previews/BusinessPreview";
import { MapMarkerComponent } from "./MapMarkerComponent";
import { getMarketRegion } from "../../utils/geo/marketRegions";
import { BusinessPublicPreview } from "@tagly/models/v2/customerApp";
import type { SupportedLocale } from "@tagly/models/shared";
import { getBusinessesInRegion } from "@tagly/sdk/v2/customerApp";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessMapCache } from "../../contexts/BusinessMapCacheContext";
import { useTheme } from "../../theme/ThemeProvider";
import { spacing } from "../../theme/theme";
import { withAlpha } from "../../theme/colorUtils";

// --- shared geometry helpers (trimmed) ---
type Coords = { latitude: number; longitude: number };
type Bounds = { ne: Coords; sw: Coords };
const MAX_LAT_DIFF = 0.1; // vertical
const PAD_VISIBLE_RATIO = 0.12;
const TILE_DEG = 0.05;
const PREFETCH_SCREENS_FETCH = 1.2;
const COVERAGE_SHRINK_RATIO = 0.08;
const CAMERA_ANIM_MS = 250;
const toTile = (x: number) => Math.floor(x / TILE_DEG);
const tilesForBounds = (ne: Coords, sw: Coords): string[] => {
  const latMin = toTile(sw.latitude);
  const latMax = toTile(ne.latitude);
  const lonMin = toTile(sw.longitude);
  const lonMax = toTile(ne.longitude);
  const arr: string[] = [];
  for (let i = latMin; i <= latMax; i++) {
    for (let j = lonMin; j <= lonMax; j++) arr.push(`${i}:${j}`);
  }
  return arr;
};
const isZoomedOut = (ne: Coords, sw: Coords) =>
  Math.abs(ne.latitude - sw.latitude) > MAX_LAT_DIFF;
const expandBounds = (
  ne: Coords,
  sw: Coords,
  pad = PAD_VISIBLE_RATIO,
): Bounds => ({
  ne: { latitude: ne.latitude + pad, longitude: ne.longitude + pad },
  sw: { latitude: sw.latitude - pad, longitude: sw.longitude - pad },
});
const expandBoundsByScreens = (
  ne: Coords,
  sw: Coords,
  screens: number,
): Bounds => {
  const latSpan = Math.abs(ne.latitude - sw.latitude);
  const lonSpan = Math.abs(ne.longitude - sw.longitude);
  const latPad = latSpan * screens;
  const lonPad = lonSpan * screens;
  return {
    ne: { latitude: ne.latitude + latPad, longitude: ne.longitude + lonPad },
    sw: { latitude: sw.latitude - latPad, longitude: sw.longitude - lonPad },
  };
};
const isInside = (p: Coords, ne: Coords, sw: Coords) =>
  p.latitude <= ne.latitude &&
  p.longitude <= ne.longitude &&
  p.latitude >= sw.latitude &&
  p.longitude >= sw.longitude;
const shrinkBounds = (b: Bounds, r: number): Bounds => {
  const latSpan = b.ne.latitude - b.sw.latitude;
  const lonSpan = b.ne.longitude - b.sw.longitude;
  const latPad = latSpan * r;
  const lonPad = lonSpan * r;
  return {
    ne: {
      latitude: b.ne.latitude - latPad,
      longitude: b.ne.longitude - lonPad,
    },
    sw: {
      latitude: b.sw.latitude + latPad,
      longitude: b.sw.longitude + lonPad,
    },
  };
};
const containsBounds = (outer: Bounds, inner: Bounds) =>
  inner.sw.latitude >= outer.sw.latitude &&
  inner.sw.longitude >= outer.sw.longitude &&
  inner.ne.latitude <= outer.ne.latitude &&
  inner.ne.longitude <= outer.ne.longitude;
const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  ne: {
    latitude: Math.max(a.ne.latitude, b.ne.latitude),
    longitude: Math.max(a.ne.longitude, b.ne.longitude),
  },
  sw: {
    latitude: Math.min(a.sw.latitude, b.sw.latitude),
    longitude: Math.min(a.sw.longitude, b.sw.longitude),
  },
});

// Carousel item — defined outside BusinessMap so the component type is stable across renders.
// Defining it inside (even via useMemo) creates a new type on every dep change, forcing
// React to unmount+remount every list item instead of reconciling.
interface CarouselItemProps {
  item: BusinessPublicPreview;
  index: number;
  itemWidth: number;
  itemSpacing: number;
  isSelected: boolean;
  hasSelection: boolean;
  dimUnselected: boolean;
  showEarnButton?: boolean;
  // Primitives (not the location object) so memo comparison stays cheap.
  currentLat?: number;
  currentLon?: number;
  titleBackgroundColor: string;
  onPress: () => void;
}

// Thin wrapper over the shared BusinessPreview: maps carousel state onto the
// card's props (selection, dimming, the earn CTA) and supplies the horizontal
// gap between items. The card owns its own layout + full height — see
// `businessPreviewHeight`.
const CarouselItem = React.memo(
  function CarouselItem({
    item,
    index,
    itemWidth,
    itemSpacing,
    isSelected,
    dimUnselected,
    showEarnButton,
    currentLat,
    currentLon,
    titleBackgroundColor,
    onPress,
  }: CarouselItemProps) {
    return (
      <BusinessPreview
        business={item}
        width={itemWidth}
        selected={isSelected}
        showEarnButton={showEarnButton}
        dimmed={dimUnselected && !isSelected}
        currentLocation={
          typeof currentLat === "number" && typeof currentLon === "number"
            ? { lat: currentLat, lon: currentLon }
            : null
        }
        style={{ marginHorizontal: itemSpacing / 2 }}
        titleBackgroundColor={titleBackgroundColor}
        onPress={onPress}
      />
    );
  },
  (prev, next) =>
    prev.item.uid === next.item.uid &&
    prev.index === next.index &&
    prev.isSelected === next.isSelected &&
    prev.hasSelection === next.hasSelection &&
    prev.itemWidth === next.itemWidth &&
    prev.itemSpacing === next.itemSpacing &&
    prev.dimUnselected === next.dimUnselected &&
    prev.showEarnButton === next.showEarnButton &&
    prev.currentLat === next.currentLat &&
    prev.currentLon === next.currentLon,
);

// Marker item — same rationale as CarouselItem: defined outside BusinessMap so the
// component type is stable. React.memo with a comparator means only the 2 markers
// whose isSelected state actually changes re-render (and re-snapshot) on each tap,
// instead of all 40–80+ markers.
interface MarkerItemProps {
  local: BusinessPublicPreview;
  coord: { latitude: number; longitude: number };
  isSelected: boolean;
  onPress: (local: BusinessPublicPreview) => void;
}
const MarkerItem = React.memo(
  function MarkerItem({ local, coord, isSelected, onPress }: MarkerItemProps) {
    const markerRef = useRef<React.ComponentRef<typeof Marker>>(null);

    // iOS (the only platform with a custom marker view — see the child below):
    // ONLY the selected marker tracks view changes, and only briefly. Two
    // things leave the selected pill un-snapshotted (blank) under
    // tracksViewChanges=false: it's the larger accent callout, and
    // `selectAnnotation` (below) makes MapKit re-lay-out the custom view. So we
    // track the selected marker until it settles, then stop. Unselected markers
    // NEVER track (cheap) — they already snapshot fine, and the marker remounts
    // on selection (key includes isSelected) for a clean capture.
    const [tracking, setTracking] = useState(isSelected);
    // Rendered height of the marker (pill + pointer). centerOffset lifts the view
    // up by half its height so the pointer tip — the bottom of the view — sits on
    // the coordinate. This replaces the old transparent spacer that doubled the
    // view height and left the empty (shadowed) area below the card tappable. Seed
    // near the real size; onLayout corrects it.
    const [height, setHeight] = useState(
      (isSelected ? 47 : 39) * (local.isSubsidizedByPlatform ? 0.85 : 1),
    );
    useEffect(() => {
      if (Platform.OS !== "ios" || !isSelected) return;
      setTracking(true);
      // Re-assert MapKit's NATIVE selection: showCallout() → selectAnnotation pins
      // the pin to the FRONT of the map's subview array — for drawing AND
      // hit-testing — which iOS zIndex/zPosition can't do (zPosition is draw-order
      // only; touches follow subview order, which MapKit sorts by latitude). This
      // is why the selected pin used to sink under neighbours / mis-tap. Small
      // delay lets the freshly-remounted annotation register; keep tracking a bit
      // longer so the post-select view is captured, then stop.
      const tShow = setTimeout(() => markerRef.current?.showCallout?.(), 50);
      const tStop = setTimeout(() => setTracking(false), 500);
      return () => {
        clearTimeout(tShow);
        clearTimeout(tStop);
      };
    }, [isSelected]);

    return (
      <Marker
        ref={markerRef}
        coordinate={coord}
        onPress={() => onPress(local)}
        // Draw order: selected always on top; among resting markers, paying
        // (non-subsidized) businesses stack over subsidized ones. iOS note:
        // zIndex maps to zPosition (draw order only) — native front-of-stack
        // selection for taps is handled by showCallout() above.
        zIndex={isSelected ? 100 : local.isSubsidizedByPlatform ? 1 : 2}
        tracksViewChanges={tracking}
        centerOffset={{ x: 0, y: -height / 2 }}
      >
        {/* Android deliberately keeps the DEFAULT pin (no custom child).
            Custom view markers are broken on Android under the New
            Architecture — clipped or blank however tracksViewChanges is set,
            and always-tracking (the community workaround) still rendered them
            cut in half on device while making the map laggy. Upstream:
            react-native-maps #5877 (closed not-planned; the Fabric layer
            doesn't map the freeze prop). Tested and abandoned 2026-08-10 —
            re-attempt only after a maps upgrade whose changelog fixes Fabric
            custom markers (then: render this child on Android too and add
            anchor={{x:0.5, y:1}}, Android's counterpart of centerOffset). */}
        {Platform.OS === "ios" && (
          <MapMarkerComponent
            local={local}
            isSelected={isSelected}
            onHeight={setHeight}
          />
        )}
      </Marker>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.onPress === next.onPress &&
    prev.local === next.local,
);

// Ref
export interface BusinessMapRef {
  /** Animate the map camera to the given region. */
  animateTo(region: Region): void;
  /** Animate the map camera to the user's current location. */
  centerOnUser(): void;
  /** Animate to a business and select its marker (used by MapControls search). */
  selectLocal(local: BusinessPublicPreview): void;
}

// Props
export interface BusinessMapProps {
  style?: StyleProp<ViewStyle>;
  fetchOnMount?: boolean;
  showCarousel?: boolean;
  showOverlays?: boolean;
  selectedUid?: string;
  onSelectedChange?(local: BusinessPublicPreview | undefined): void;
  onLocalsChange?(locals: BusinessPublicPreview[]): void;
  itemWidthRatio?: number;
  cardSpacing?: number;
  bottomCarouselOffset?: number;
  pointerEvents?: "auto" | "none";
  allowGestures?: boolean;
  dimUnselected?: boolean;
  initialRegion?: Region; // Full control
  initialZoomLevel?: number; // Simple zoom: higher = more zoomed in (e.g., 0.01 = very close, 0.1 = far)
  filterQuery?: string;
  filterTypeSlug?: string;
  onRawLocalsChange?: (locals: BusinessPublicPreview[]) => void;
  showControls?: boolean;
  controlsTopOffset?: number;
  /**
   * When true, shifts the camera center upward so the selected business
   * appears in the visible area above the carousel rather than at the raw
   * map center (which is partially obscured by the carousel).
   */
  autoOffsetCameraForCarousel?: boolean;
  /**
   * When true, shows the "Earn here" CTA below each carousel card. The CTA's
   * action lives inside `BusinessPreview` (routes to the share-create flow); the
   * card itself opens the business detail on tap.
   */
  showEarnButton?: boolean;
  /**
   * The customer's self-reported story-views estimate, for reward projection
   * when no IG insights exist. Injected by the caller (customer-only state).
   */
  /**
   * Customer's home-market locale (US/CZ) for the controls' "Center at" city
   * jump. Injected by the caller (customer-only state) — not the UI language.
   */
  locale?: SupportedLocale;
  /**
   * Height in pixels of any overlay covering the top of the map (e.g. the top menu).
   * Used by autoOffsetCameraForCarousel to correctly center the selected marker in the
   * visible area between the top overlay and the carousel, rather than the full map center.
   */
  topOverlayHeight?: number;
}

export const BusinessMap = React.forwardRef<BusinessMapRef, BusinessMapProps>(
  (
    {
      style,
      fetchOnMount = false,
      showCarousel = true,
      showOverlays = true,
      selectedUid,
      onSelectedChange,
      onLocalsChange,
      itemWidthRatio = 0.65,
      cardSpacing = 12,
      bottomCarouselOffset,
      pointerEvents = "auto",
      allowGestures = true,
      dimUnselected = true,
      initialRegion,
      initialZoomLevel = 0.03, // Default zoom level
      filterQuery,
      filterTypeSlug,
      onRawLocalsChange,
      showControls = false,
      controlsTopOffset,
      autoOffsetCameraForCarousel = false,
      showEarnButton = false,
      topOverlayHeight = 0,
      locale,
    },
    ref,
  ) => {
    const { t } = useTranslation("map");
    const router = useRouter();
    const { currentLocation, permissionStatus } = useCurrentLocation();
    const { theme } = useTheme();
    const { color, text, radius, shadow } = theme;
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const effectiveBottomCarouselOffset =
      bottomCarouselOffset || insets.bottom + spacing.md;

    // Cache refs (shared)
    const {
      localsByUidRef,
      coordsByUidRef,
      fetchedTilesRef,
      fetchedBoundsRef,
      coverageBoundsRef,
      cacheVersion,
    } = useBusinessMapCache();

    // Per-instance refs/state
    const mapRef = useRef<MapView>(null);
    const listRef = useRef<FlatList<BusinessPublicPreview>>(null);
    const pressedMarkerRef = useRef(false);
    const isFetchingRef = useRef(false);
    const userHasScrolledCarouselRef = useRef(false);
    // For the one-time recenter onto the user's location once a fix arrives
    // (the map mounts on the fallback region before the async fix lands, and
    // `initialRegion` can't be changed after mount). Skipped if the user has
    // already panned, so we never yank the map out from under them.
    const userMovedMapRef = useRef(false);
    const didAutoCenterRef = useRef(false);

    const [internalSelectedUid, setInternalSelectedUid] = useState<
      string | undefined
    >();
    const isControlled = selectedUid !== undefined;
    const effectiveSelectedUid = isControlled
      ? selectedUid
      : internalSelectedUid;

    const [loading, setLoading] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [zoomTooFar, setZoomTooFar] = useState(false);
    const [allFetchedUids, setAllFetchedUids] = useState<string[]>([]);
    const [visibleUids, setVisibleUids] = useState<string[]>([]);

    // Internal filter state — used when showControls={true}
    const currentMapCenterRef = useRef<{
      latitude: number;
      longitude: number;
    } | null>(null);
    // Tracks the latest latitudeDelta so centerOnLocal can convert a pixel offset to degrees
    const currentLatDeltaRef = useRef(initialZoomLevel);
    const [internalSelectedTypeSlugs, setInternalSelectedTypeSlugs] = useState<
      string[]
    >([]);
    const [internalAvailableTypeSlugs, setInternalAvailableTypeSlugs] =
      useState<string[]>([]);

    // Carousel layout
    const ITEM_WIDTH = Math.round(width * itemWidthRatio);
    const ITEM_SPACING = cardSpacing;
    const SNAP_INTERVAL = ITEM_WIDTH + ITEM_SPACING;
    // Full carousel-item height (the 16:9 card + the earn CTA below it when
    // shown) — the card owns this, so there's one source of truth for the
    // camera offset and status-pill positioning below.
    const CAROUSEL_ITEM_HEIGHT = businessPreviewHeight(ITEM_WIDTH, {
      withButton: showEarnButton,
    });
    // Padding so that item i is visually centered when scrolled to i * SNAP_INTERVAL
    const SIDE_PAD = (width - ITEM_WIDTH) / 2 - ITEM_SPACING / 2;

    const [currentIndex, setCurrentIndex] = useState(0);
    const currentIndexRef = useRef(0);
    useEffect(() => {
      currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    // Set to true by centerOnLocal so the visibleLocals effect below can re-scroll
    // once after the region fetch reshuffles the list.
    const pendingRescrollRef = useRef(false);

    const computedInitialRegion: Region = useMemo(() => {
      // Explicit override wins; otherwise the map opens on the customer's
      // home-market city (US → Tampa, CZ → Prague). We deliberately don't start
      // on the device location — the one-time auto-recenter below flies there
      // once a fix arrives (and the compass control recenters on demand).
      return initialRegion ?? getMarketRegion(locale);
    }, [initialRegion, locale]);

    // One-time recenter onto the user once a location fix arrives. The map mounts
    // on the fallback region before the async permission/fix resolves, and
    // `initialRegion` can't be changed after mount — so animate to the fix the
    // first time it lands (skipped if an explicit `initialRegion` was given, or
    // if the user has already panned).
    useEffect(() => {
      if (didAutoCenterRef.current) return;
      if (initialRegion) return;
      if (!mapReady || !currentLocation) return;
      if (userMovedMapRef.current) {
        didAutoCenterRef.current = true;
        return;
      }
      didAutoCenterRef.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: initialZoomLevel,
          longitudeDelta: initialZoomLevel,
        },
        CAMERA_ANIM_MS,
      );
    }, [mapReady, currentLocation, initialRegion, initialZoomLevel]);

    // Location denied → no device fix is ever coming, and the map was mounted on
    // the home-market fallback baked from whatever `locale` was at mount — which
    // is `undefined` (→ the Prague default) while the customer is still loading.
    // `MapView.initialRegion` is mount-only, so once `locale` actually resolves we
    // must animate the camera to the correct market region ourselves; otherwise a
    // US user who denied location stays stranded on Prague. Skipped when an explicit
    // region was given, when a fix exists or is still pending (the user-recenter
    // above owns that case), or once the user has panned. Deliberately not latched
    // via `didAutoCenterRef` — it re-runs when `locale` finally lands.
    useEffect(() => {
      if (initialRegion) return;
      if (!mapReady) return;
      if (didAutoCenterRef.current) return;
      if (userMovedMapRef.current) return;
      if (currentLocation) return;
      if (permissionStatus !== "denied") return;
      mapRef.current?.animateToRegion(getMarketRegion(locale), CAMERA_ANIM_MS);
    }, [mapReady, permissionStatus, currentLocation, initialRegion, locale]);

    // Recompute which businesses appear in the carousel based on current map bounds.
    // Markers are NOT driven by this — all fetched businesses always have a Marker.
    const recomputeVisibleFromCache = useCallback(async () => {
      if (!mapRef.current) return;
      // getMapBoundaries is a native call that can reject (map mid-teardown) —
      // and one call site fires this without awaiting, so a rejection here must
      // never escape. No visible businesses to recompute in that case.
      let bounds;
      try {
        bounds = await mapRef.current.getMapBoundaries();
      } catch {
        return;
      }
      const { northEast, southWest } = bounds;
      if (isZoomedOut(northEast, southWest)) {
        setZoomTooFar(true);
        return;
      }
      setZoomTooFar(false);

      const { ne, sw } = expandBounds(northEast, southWest, PAD_VISIBLE_RATIO);
      const next: string[] = [];
      localsByUidRef.current.forEach((_b, uid) => {
        const c = coordsByUidRef.current.get(uid);
        if (c && isInside(c, ne, sw)) next.push(uid);
      });
      setVisibleUids(next);
    }, [coordsByUidRef, localsByUidRef]);

    const snapIntervalRef = useRef(SNAP_INTERVAL);
    useEffect(() => {
      snapIntervalRef.current = SNAP_INTERVAL;
    }, [SNAP_INTERVAL]);

    const sidePadRef = useRef(SIDE_PAD);
    useEffect(() => {
      sidePadRef.current = SIDE_PAD;
    }, [SIDE_PAD]);

    // Suppresses onMomentumScrollEnd during code-initiated animated scrolls to break
    // the feedback loop: programmatic scroll → momentumEnd → centerOnLocal → scroll → loop.
    const isProgrammaticScrollRef = useRef(false);
    const programmaticScrollTimerRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const scrollToOffset = useCallback((offset: number) => {
      if (programmaticScrollTimerRef.current)
        clearTimeout(programmaticScrollTimerRef.current);
      isProgrammaticScrollRef.current = true;
      listRef.current?.scrollToOffset({ offset, animated: true });
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 800);
    }, []);

    // Stable ref for effectiveSelectedUid — placed here so getVisibleBusinesses
    // (below) can read it without creating a stale closure dependency.
    const effectiveSelectedUidRef = useRef(effectiveSelectedUid);
    effectiveSelectedUidRef.current = effectiveSelectedUid;

    // Fetch
    const getVisibleBusinesses = useCallback(async () => {
      if (!mapRef.current || isFetchingRef.current) {
        setLoading(false);
        return;
      }
      // The outer try/finally owns the `loading` reset: every exit — early
      // returns, the fetch, AND a rejecting native getMapBoundaries (map
      // mid-teardown) — must clear the pill, or it sticks until the next
      // completed region change.
      try {
        const bounds = await mapRef.current.getMapBoundaries();
        const { northEast, southWest } = bounds;

        if (isZoomedOut(northEast, southWest)) {
          setZoomTooFar(true);
          return;
        }
        setZoomTooFar(false);

        const viewport: Bounds = { ne: northEast, sw: southWest };
        if (coverageBoundsRef.current) {
          const conservative = shrinkBounds(
            coverageBoundsRef.current,
            COVERAGE_SHRINK_RATIO,
          );
          if (containsBounds(conservative, viewport)) {
            setAllFetchedUids(Array.from(localsByUidRef.current.keys()));
            await recomputeVisibleFromCache();
            return;
          }
        }

        const fetchRect = expandBoundsByScreens(
          northEast,
          southWest,
          PREFETCH_SCREENS_FETCH,
        );
        const neededTiles = tilesForBounds(fetchRect.ne, fetchRect.sw);
        const allCached = neededTiles.every((k) =>
          fetchedTilesRef.current.has(k),
        );

        if (allCached) {
          fetchedBoundsRef.current = fetchedBoundsRef.current
            ? unionBounds(fetchedBoundsRef.current, fetchRect)
            : fetchRect;
          coverageBoundsRef.current = fetchRect;
          setAllFetchedUids(Array.from(localsByUidRef.current.keys()));
          await recomputeVisibleFromCache();
          return;
        }

        // fetch missing
        isFetchingRef.current = true;
        try {
          const result = await callAuthed(router, (jwt) =>
            getBusinessesInRegion({
              jwt,
              query: {
                NElat: fetchRect.ne.latitude,
                NElon: fetchRect.ne.longitude,
                SWlat: fetchRect.sw.latitude,
                SWlon: fetchRect.sw.longitude,
              },
            }),
          );
          if (result.ok && result.data) {
            const fetched: BusinessPublicPreview[] =
              result.data.businesses || [];
            for (const b of fetched) {
              localsByUidRef.current.set(b.uid, b);
              const crd = b.address.location!;
              coordsByUidRef.current.set(b.uid, {
                latitude: crd.lat,
                longitude: crd.lon,
              });
            }
            setAllFetchedUids(Array.from(localsByUidRef.current.keys()));
            // If the result was capped, don't mark tiles as cached — a smaller viewport
            // may return different (closer) businesses, so we must re-fetch on zoom/pan.
            if (!result.data.isCapped) {
              neededTiles.forEach((k) => fetchedTilesRef.current.add(k));
              fetchedBoundsRef.current = fetchedBoundsRef.current
                ? unionBounds(fetchedBoundsRef.current, fetchRect)
                : fetchRect;
              coverageBoundsRef.current = fetchRect;
            }
          }
        } finally {
          isFetchingRef.current = false;
          void recomputeVisibleFromCache();
        }
      } catch {
        // Boundary read failed — nothing to recompute; the next region change
        // re-runs. The finally below still clears the pill.
      } finally {
        setLoading(false);
      }
    }, [
      router,
      recomputeVisibleFromCache,
      coordsByUidRef,
      localsByUidRef,
      fetchedTilesRef,
      fetchedBoundsRef,
      coverageBoundsRef,
    ]);

    const debouncedFetch = useMemo(
      () => debounce(() => void getVisibleBusinesses(), 500),
      [getVisibleBusinesses],
    );
    useEffect(() => () => debouncedFetch.cancel(), [debouncedFetch]);

    // When the cache is reset externally (e.g. Instagram connects, story views change),
    // clear local derived state so stale markers disappear, then trigger a fresh fetch.
    const prevCacheVersionRef = useRef(cacheVersion);
    useEffect(() => {
      if (cacheVersion === prevCacheVersionRef.current) return;
      prevCacheVersionRef.current = cacheVersion;
      setAllFetchedUids([]);
      setVisibleUids([]);
      void getVisibleBusinesses();
    }, [cacheVersion, getVisibleBusinesses]);

    // Marker selection handling
    const setSelected = useCallback(
      (uid: string | undefined) => {
        if (!isControlled) {
          setInternalSelectedUid(uid);
        }
        if (onSelectedChange) {
          const val = uid ? localsByUidRef.current.get(uid) : undefined;
          onSelectedChange(val);
        }
      },
      [isControlled, onSelectedChange, localsByUidRef],
    );

    const centerOnLocal = useCallback(
      (b: BusinessPublicPreview) => {
        const coord = b.address.location;
        if (!coord || !mapRef.current) return;
        setSelected(b.uid);
        setVisibleUids((prev) =>
          prev.includes(b.uid) ? prev : [...prev, b.uid],
        );
        pressedMarkerRef.current = true;

        // When autoOffsetCameraForCarousel is on, shift the camera center southward
        // so the business appears in the visible area above the carousel rather than
        // at the raw map center (which sits behind the carousel).
        // offsetPx = half the carousel's total bottom footprint (padding + card height).
        // Convert to degrees: offsetDeg = (offsetPx / mapHeight) * latitudeDelta.
        let centerLat = coord.lat;
        if (autoOffsetCameraForCarousel) {
          const carouselHeightPx = CAROUSEL_ITEM_HEIGHT;
          const offsetPx =
            (effectiveBottomCarouselOffset +
              carouselHeightPx -
              topOverlayHeight) /
            2;
          const offsetDeg = (offsetPx / height) * currentLatDeltaRef.current;
          centerLat = coord.lat - offsetDeg;
        }

        mapRef.current.animateCamera(
          { center: { latitude: centerLat, longitude: coord.lon } },
          { duration: CAMERA_ANIM_MS },
        );
        setTimeout(() => {
          pressedMarkerRef.current = false;
          // Seed into cache so recomputeVisibleFromCache picks it up immediately,
          // even if this tile hasn't been fetched yet (e.g. tapped from search results).
          if (!localsByUidRef.current.has(b.uid)) {
            localsByUidRef.current.set(b.uid, b);
            coordsByUidRef.current.set(b.uid, {
              latitude: coord.lat,
              longitude: coord.lon,
            });
          }
          // Arm before recompute so the visibleLocals useEffect scrolls on the resulting change.
          pendingRescrollRef.current = true;
          recomputeVisibleFromCache();
        }, CAMERA_ANIM_MS + 20);
      },
      [
        autoOffsetCameraForCarousel,
        ITEM_WIDTH,
        effectiveBottomCarouselOffset,
        topOverlayHeight,
        height,
        recomputeVisibleFromCache,
        scrollToOffset,
        setSelected,
      ],
    );

    const visibleLocalsRef = useRef<BusinessPublicPreview[]>([]);

    const rawVisibleLocals: BusinessPublicPreview[] = useMemo(() => {
      const out: BusinessPublicPreview[] = [];
      for (const uid of visibleUids) {
        const b = localsByUidRef.current.get(uid);
        if (b) out.push(b);
      }
      if (
        effectiveSelectedUid &&
        !out.some((b) => b.uid === effectiveSelectedUid) &&
        localsByUidRef.current.has(effectiveSelectedUid)
      ) {
        out.push(localsByUidRef.current.get(effectiveSelectedUid)!);
      }
      if (onRawLocalsChange) onRawLocalsChange(out);
      return out;
    }, [visibleUids, effectiveSelectedUid, localsByUidRef, onRawLocalsChange]);

    // Derive available filter categories from raw visible locals (after render, not during)
    useEffect(() => {
      if (!showControls) return;
      const slugs = Array.from(
        new Set(rawVisibleLocals.map((l) => l.type.slug)),
      ).sort();
      setInternalAvailableTypeSlugs(slugs);
    }, [rawVisibleLocals, showControls]);

    const effectiveFilterQuery = showControls ? "" : (filterQuery ?? "");
    // Multi-select type filter (empty = all). External `filterTypeSlug` (single)
    // is wrapped into the array so the controlled mode still works.
    const effectiveSelectedTypeSlugs = useMemo(
      () =>
        showControls
          ? internalSelectedTypeSlugs
          : filterTypeSlug
            ? [filterTypeSlug]
            : [],
      [showControls, internalSelectedTypeSlugs, filterTypeSlug],
    );

    const visibleLocals: BusinessPublicPreview[] = useMemo(() => {
      let result = rawVisibleLocals;
      const q = effectiveFilterQuery.toLowerCase().trim();
      if (q) result = result.filter((b) => b.name.toLowerCase().includes(q));
      if (effectiveSelectedTypeSlugs.length > 0)
        result = result.filter((b) =>
          effectiveSelectedTypeSlugs.includes(b.type.slug),
        );

      // Update ref for use in callbacks
      visibleLocalsRef.current = result;

      if (onLocalsChange) onLocalsChange(result);
      return result;
    }, [
      rawVisibleLocals,
      effectiveFilterQuery,
      effectiveSelectedTypeSlugs,
      onLocalsChange,
    ]);

    // After a region fetch reshuffles visibleLocals, re-scroll to the selected business once.
    useEffect(() => {
      if (!pendingRescrollRef.current) return;
      const uid = effectiveSelectedUidRef.current;
      if (!uid) {
        pendingRescrollRef.current = false;
        return;
      }
      const idx = visibleLocalsRef.current.findIndex((x) => x.uid === uid);
      if (idx >= 0) {
        scrollToOffset(idx * snapIntervalRef.current);
        setCurrentIndex(idx);
      }
    }, [visibleLocals, scrollToOffset]);

    // Handlers
    const handleMarkerPress = useCallback(
      (b: BusinessPublicPreview) => {
        // Tapping an unselected marker selects + centers it; tapping the
        // already-selected marker opens the detail.
        if (effectiveSelectedUidRef.current === b.uid) {
          // Cast: a customer-app route; this shared component is also
          // typechecked against the advertiser app's typed routes, which
          // don't include it (the map never mounts there).
          router.push({
            pathname: "/businesses/[uid]",
            params: { uid: b.uid },
          } as unknown as Href);
        } else {
          centerOnLocal(b);
        }
      },
      [centerOnLocal, router],
    );

    // Region change
    const handleRegionChange = useCallback(() => {
      Keyboard.dismiss();
      if (pressedMarkerRef.current) return;
      setLoading(true);
    }, []);
    const handleRegionChangeComplete = useCallback(
      (region: Region) => {
        currentMapCenterRef.current = {
          latitude: region.latitude,
          longitude: region.longitude,
        };
        currentLatDeltaRef.current = region.latitudeDelta;
        if (pressedMarkerRef.current) {
          pressedMarkerRef.current = false;
          setLoading(false);
          return;
        }
        debouncedFetch();
      },
      [debouncedFetch],
    );

    // Map ready
    const onMapReady = useCallback(() => {
      setMapReady(true);
      setLoading(true);
      if (fetchOnMount) {
        getVisibleBusinesses();
      } else {
        // still attempt cache / fetch missing tiles lazily
        getVisibleBusinesses();
      }
      recomputeVisibleFromCache();
    }, [fetchOnMount, getVisibleBusinesses, recomputeVisibleFromCache]);

    useImperativeHandle(
      ref,
      () => ({
        animateTo(region: Region) {
          mapRef.current?.animateToRegion(region, CAMERA_ANIM_MS);
        },
        centerOnUser() {
          if (!currentLocation) return;
          mapRef.current?.animateCamera(
            {
              center: {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              },
            },
            { duration: CAMERA_ANIM_MS },
          );
        },
        selectLocal(local: BusinessPublicPreview) {
          centerOnLocal(local);
        },
      }),
      [currentLocation, centerOnLocal],
    );

    const renderCarouselItem = useCallback(
      ({ item, index }: ListRenderItemInfo<BusinessPublicPreview>) => (
        <CarouselItem
          item={item}
          index={index}
          itemWidth={ITEM_WIDTH}
          itemSpacing={ITEM_SPACING}
          isSelected={effectiveSelectedUidRef.current === item.uid}
          hasSelection={!!effectiveSelectedUidRef.current}
          dimUnselected={dimUnselected}
          showEarnButton={showEarnButton}
          currentLat={currentLocation?.latitude}
          currentLon={currentLocation?.longitude}
          titleBackgroundColor={color.background}
          onPress={() => {
            // First tap selects (centers) an unselected card; a tap on the
            // already-selected card opens the detail.
            if (effectiveSelectedUidRef.current === item.uid) {
              router.push({
                pathname: "/businesses/[uid]",
                params: { uid: item.uid },
              } as unknown as Href);
            } else {
              centerOnLocal(item);
            }
          }}
        />
      ),
      [
        ITEM_WIDTH,
        ITEM_SPACING,
        dimUnselected,
        showEarnButton,
        currentLocation?.latitude,
        currentLocation?.longitude,
        centerOnLocal,
        router,
      ],
    );

    const snapToOffsets = useMemo(
      () => visibleLocals.map((_, i) => i * SNAP_INTERVAL),
      [visibleLocals, SNAP_INTERVAL],
    );

    const handleMomentumScrollEnd = useCallback(
      (e: any) => {
        if (isProgrammaticScrollRef.current) return;
        if (!userHasScrolledCarouselRef.current) return;
        const offsetX = e.nativeEvent.contentOffset.x;
        const raw = offsetX / SNAP_INTERVAL;
        const index = Math.round(raw);
        const clamped = Math.max(0, Math.min(index, visibleLocals.length - 1));
        setCurrentIndex(clamped);
        const b = visibleLocals[clamped];
        if (b) {
          const already = b.uid === effectiveSelectedUid;
          if (!already) centerOnLocal(b);
        }
      },
      [visibleLocals, effectiveSelectedUid, centerOnLocal, SNAP_INTERVAL],
    );

    // Clear selection when the user pans to an area with no visible businesses
    useEffect(() => {
      if (!loading && visibleLocals.length === 0 && effectiveSelectedUid) {
        setSelected(undefined);
      }
    }, [loading, visibleLocals.length, effectiveSelectedUid, setSelected]);

    const carouselIsVisible = showCarousel && visibleLocals.length > 0;
    const overlayBottom = carouselIsVisible
      ? effectiveBottomCarouselOffset + CAROUSEL_ITEM_HEIGHT + spacing.md
      : effectiveBottomCarouselOffset + spacing.md;

    // Floating status pill (loading / zoom / empty): ink fill + on.ink text, warm
    // float shadow, no border — reads clearly over the map.
    const overlayCardStyle = {
      backgroundColor: withAlpha(color.background, 0.8),
      boxShadow: shadow.float,
      borderRadius: radius.pill,
    };

    // Render markers
    return (
      <View style={[{ flex: 1 }, style]} pointerEvents={pointerEvents}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={computedInitialRegion}
          showsUserLocation
          moveOnMarkerPress={false}
          onMapReady={onMapReady}
          // A user drag cancels the one-time auto-recenter onto their location.
          onPanDrag={() => {
            userMovedMapRef.current = true;
          }}
          onPress={() => {
            Keyboard.dismiss();
            if (!pressedMarkerRef.current) setSelected(undefined);
          }}
          onRegionChange={allowGestures ? handleRegionChange : undefined}
          onRegionChangeComplete={
            allowGestures ? handleRegionChangeComplete : undefined
          }
          scrollEnabled={allowGestures}
          zoomEnabled={allowGestures}
          rotateEnabled={allowGestures}
          pitchEnabled={allowGestures}
          mapType="standard"
          // Force Apple Maps to light regardless of the system theme — the app
          // does not support dark mode (iOS Apple Maps only, iOS >= 13).
          userInterfaceStyle="light"
        >
          {mapReady &&
            // Key includes isSelected so the marker REMOUNTS on selection — that's
            // what reliably refreshes its snapshot (the selected marker also
            // re-asserts native selectAnnotation on mount, see MarkerItem).
            allFetchedUids.map((uid) => {
              const local = localsByUidRef.current.get(uid);
              const coord = coordsByUidRef.current.get(uid);
              if (!local || !coord) return null;
              // Hide markers that don't match the active type filter
              if (
                effectiveSelectedTypeSlugs.length > 0 &&
                !effectiveSelectedTypeSlugs.includes(local.type.slug)
              )
                return null;
              const isSelected = effectiveSelectedUid === uid;
              return (
                <MarkerItem
                  key={`${local.uid}-${isSelected}`}
                  local={local}
                  coord={coord}
                  isSelected={isSelected}
                  onPress={handleMarkerPress}
                />
              );
            })}
        </MapView>

        {showOverlays && (
          <>
            {loading && (
              <View
                style={[
                  overlayCardStyle,
                  {
                    position: "absolute",
                    bottom: overlayBottom,
                    paddingHorizontal: spacing.md,
                    alignSelf: "center",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 32,
                  },
                ]}
              >
                <ActivityIndicator color={color.ink} />
              </View>
            )}
            {!loading && zoomTooFar && (
              <View
                style={[
                  overlayCardStyle,
                  {
                    position: "absolute",
                    bottom: overlayBottom,
                    paddingHorizontal: spacing.md,
                    alignSelf: "center",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 32,
                  },
                ]}
              >
                <Text style={[text.label, { color: color.ink }]}>
                  {allFetchedUids.length > 0
                    ? t("zoomInToLoad")
                    : t("zoomInToDisplay")}
                </Text>
              </View>
            )}
            {!loading && !zoomTooFar && visibleLocals.length === 0 && (
              <View
                style={[
                  overlayCardStyle,
                  {
                    position: "absolute",
                    bottom: overlayBottom,
                    paddingHorizontal: spacing.md,
                    alignSelf: "center",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 32,
                  },
                ]}
              >
                <Text style={[text.label, { color: color.ink }]}>
                  {t("noBusinessesInArea")}
                </Text>
              </View>
            )}
          </>
        )}

        {showCarousel && visibleLocals.length > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: effectiveBottomCarouselOffset,
              width: "100%",
            }}
          >
            <FlatList
              ref={listRef}
              horizontal
              data={visibleLocals}
              keyExtractor={(b) => b.uid}
              renderItem={renderCarouselItem}
              showsHorizontalScrollIndicator={false}
              ListHeaderComponent={<View style={{ width: SIDE_PAD }} />}
              ListFooterComponent={<View style={{ width: SIDE_PAD }} />}
              snapToAlignment="start"
              snapToOffsets={snapToOffsets}
              decelerationRate="fast"
              onScrollBeginDrag={() => {
                userHasScrolledCarouselRef.current = true;
                pendingRescrollRef.current = false;
              }}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              getItemLayout={(_, index) => ({
                length: SNAP_INTERVAL,
                offset: SIDE_PAD + SNAP_INTERVAL * index,
                index,
              })}
              initialScrollIndex={0}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({
                    index: Math.min(info.index, visibleLocals.length - 1),
                    animated: true,
                  });
                }, 50);
              }}
              extraData={effectiveSelectedUid}
            />
          </View>
        )}
        {showControls && (
          <MapControls
            availableTypeSlugs={internalAvailableTypeSlugs}
            selectedTypeSlugs={internalSelectedTypeSlugs}
            setSelectedTypeSlugs={setInternalSelectedTypeSlugs}
            onCenterOnUser={() => {
              if (!currentLocation) return;
              mapRef.current?.animateCamera(
                {
                  center: {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  },
                },
                { duration: CAMERA_ANIM_MS },
              );
            }}
            onAnimateTo={(region) =>
              mapRef.current?.animateToRegion(region, CAMERA_ANIM_MS)
            }
            locale={locale}
            topOffset={controlsTopOffset ?? spacing.xl}
          />
        )}
      </View>
    );
  },
);

BusinessMap.displayName = "BusinessMap";
