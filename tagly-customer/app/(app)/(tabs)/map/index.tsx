import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  BusinessMap,
  LocationPermissionNotice,
  NoticeStack,
  RewardEstimatePendingNotice,
  TopMenu,
  useCurrentLocation,
  useNavBottomPadding,
  useTheme,
  ZoomOnFocus,
} from "@tagly/client";
import type { ReactNode } from "react";
import { useCustomer } from "@/contexts/Customer";

/**
 * Map tab — the app's main screen: the full-bleed business map (shared
 * `BusinessMap` from `@tagly/client`) with a translucent top bar floating over
 * it, so the map shows through. The map owns its own controls, carousel, and
 * markers; this screen injects the customer-only bits (the story-views reward
 * estimate) and insets the map's controls + camera below the measured bar
 * height. Carousel cards route themselves: tapping one opens the business detail
 * (`BusinessPreview` owns that); the "Earn here" CTA routes to the share-create
 * flow.
 */
export default function MapScreen() {
  const { t } = useTranslation("tabs");
  const { theme } = useTheme();
  const { layout } = theme;
  const navBottomPadding = useNavBottomPadding();
  const { customer } = useCustomer();
  const { permissionStatus } = useCurrentLocation();
  const [topBarHeight, setTopBarHeight] = useState(0);

  // Location denied → we have no fix (the map falls back to the home market);
  // offer a jump to Settings. Connected but the IG audience snapshot isn't taken
  // yet → rewards are still calculating. Both can be true; they page in the stack.
  const locationDenied = permissionStatus === "denied";
  const snapshotPending =
    !!customer?.instagram && customer.instagram.hasSnapshot === false;

  // Priority order: the act-on notice (location) leads, the informational one
  // (rewards) follows and peeks. NoticeStack renders a single notice plainly.
  const notices: ReactNode[] = [];
  if (locationDenied)
    notices.push(<LocationPermissionNotice key="location" />);
  if (snapshotPending)
    notices.push(<RewardEstimatePendingNotice key="rewards" />);

  return (
    <ZoomOnFocus>
      <BusinessMap
        fetchOnMount
        showCarousel
        showControls
        showOverlays
        showEarnButton
        autoOffsetCameraForCarousel
        bottomCarouselOffset={navBottomPadding}
        controlsTopOffset={topBarHeight}
        topOverlayHeight={topBarHeight}
        locale={customer?.locale}
      />

      {/* Translucent bar floats over the full-bleed map; box-none lets the map
          stay pannable beneath it. We measure its height to inset the map's
          controls + selected-marker camera centering. */}
      <View
        pointerEvents="box-none"
        onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <TopMenu title={t("map")} />
        {/* Inside the measured overlay so the map insets its controls + camera
            below the notice(s) (no overlap with the top-left controls). */}
        {notices.length > 0 && (
          // Full-bleed: NoticeStack applies the horizontal screen padding itself
          // (the pager spans edge to edge so cards can page in from the screen edge).
          <NoticeStack
            notices={notices}
            style={{ marginTop: layout.screenPadding }}
          />
        )}
      </View>
    </ZoomOnFocus>
  );
}
