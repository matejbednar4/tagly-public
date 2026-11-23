import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import {
  TopMenu,
  BottomActionBar,
  BusinessTagChips,
  CustomButton,
  RewardCalculatingIndicator,
  RewardInfoSheet,
  useTheme,
  useFormatBudget,
  useCatalogLocalizer,
  useCurrentLocation,
  useUserPreferences,
  calculateDistance,
  formatTimeOfDay,
  isBusinessOpenNow,
  pressFeedbackStyle,
  customAlert,
  MapMarkerComponent,
  spacing,
  layout,
  type AlertButton,
  withAlpha,
} from "@tagly/client";
import MapView, { Marker } from "react-native-maps";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { CustomMediaType } from "@tagly/client/components/media/CustomMedia";
import { FullscreenMediaGallery } from "@tagly/client/components/media/FullscreenMediaGallery";
import type { OpeningHoursPeriod } from "@tagly/models/v2/customerApp";
import { useBusiness } from "@/hooks/details/useBusiness";
import { useCustomer } from "@/contexts/Customer";

/** Join the reach clause into one non-breaking unit so it wraps to the next line
 *  as a whole instead of splitting (e.g. "(with ~5,000 / reach)"). */
const noBreak = (s: string) => s.split(" ").join(String.fromCharCode(160));

/**
 * Business detail screen (`/businesses/:uid`) — DRAFT.
 *
 * Layout: a contained banner + a full-width photo strip (all tap → swipeable
 * fullscreen gallery); then the identity block (name · type · subsidized · IG
 * handle); a prominent reward hero card ("you could earn X" + reach + the
 * localized reward-message bullets); present-only contact/link actions; about;
 * tags; opening hours (client-computed "open now"); and the full address.
 * "Earn here" is a pinned bottom CTA. The scroll body has no horizontal padding —
 * the photo strip spans full width and every other block insets itself with
 * `marginHorizontal: layout.screenPadding`. Sections render only when data exists.
 */
export default function BusinessDetailsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessDetails");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  const { width } = useWindowDimensions();

  const formatBudget = useFormatBudget();
  const { typeName, rewardMessageName } = useCatalogLocalizer();
  const { currentLocation } = useCurrentLocation();
  const { distanceUnit } = useUserPreferences();
  const { customer } = useCustomer();

  const query = useBusiness(uid ?? "", router);
  const data = query.data;
  const isLoading = query.isLoading;
  const isError = query.isError;

  // Index into [banner, ...photos] currently open in the fullscreen gallery.
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  // The map preview's overlay drives this so the whole card shows press feedback.
  const [mapPressed, setMapPressed] = useState(false);
  // Rendered height of the map pin. iOS (Apple Maps) ignores `anchor` for
  // custom marker views and positions by `centerOffset` instead — without the
  // lift the pin centers on the coordinate and its tip points ~half the pin
  // below the true spot. Seeded near the real size; onHeight corrects it.
  const [markerHeight, setMarkerHeight] = useState(39);
  // The reward explainer sheet, opened by tapping the estimated-reward card.
  const [rewardInfoOpen, setRewardInfoOpen] = useState(false);
  // The pinned CTA bar overlays the scroll content; measure it so it clears it.
  const [ctaBarHeight, setCtaBarHeight] = useState(0);

  // In-app browser for web links; the OS handler for tel:/mailto:/maps/IG.
  const openInApp = (url: string) =>
    WebBrowser.openBrowserAsync(url).catch(() => {});
  const openExternal = (url: string) => Linking.openURL(url).catch(() => {});

  // ---- loading / error guards -------------------------------------------
  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background }}>
        <TopMenu title={t("title")} showBack />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: layout.screenPadding,
          }}
        >
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("error")}
          </Text>
        </View>
      </View>
    );
  }

  // ---- derived display values -------------------------------------------
  const hasReward = typeof data.estimatedRewardCents === "number";
  const isCalculating =
    !hasReward && data.rewardMessageSlugs.includes("NO_SNAPSHOT");
  const distanceText = currentLocation
    ? calculateDistance(
        data.address.location,
        currentLocation.latitude,
        currentLocation.longitude,
        distanceUnit,
      )
    : null;

  const openNow = isBusinessOpenNow(data.openingHours, data.timezone);
  // CZ weeks start on Monday; US on Sunday.
  const dayOrder =
    customer?.locale === "CZ" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  // Weekday labels by index (avoids a dynamically-typed `days.${n}` key).
  const dayLabels = [
    t("days.0"),
    t("days.1"),
    t("days.2"),
    t("days.3"),
    t("days.4"),
    t("days.5"),
    t("days.6"),
  ];

  // Localized "why this reward" bullets (only meaningful when there's a reward).
  const rewardMessages = hasReward
    ? data.rewardMessageSlugs.map(rewardMessageName).filter(Boolean)
    : [];

  // banner first, then photos — the order the gallery pages through.
  const galleryMedia: CustomMediaType[] = [data.banner, ...data.photos];
  const thumbHeight = Math.round((width - layout.screenPadding * 2) / 3);

  // Email confirms before handing off to the mail app.
  const confirmOpenEmail = (email: string) =>
    customAlert(t("emailConfirmTitle"), t("emailConfirmMessage", { email }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("open"), onPress: () => openExternal(`mailto:${email}`) },
    ]);

  // The IG handle confirms before leaving the app for Instagram.
  const confirmOpenInstagram = (handle: string) =>
    customAlert(
      t("instagramConfirmTitle"),
      t("instagramConfirmMessage", { handle }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("open"),
          onPress: () => openExternal(`https://instagram.com/${handle}`),
        },
      ],
    );

  // Directions: only offer navigation apps that are actually installed (Apple is
  // iOS-only and can be deleted; Waze may be absent). Google always appears —
  // its app if installed, otherwise the web map as a guaranteed fallback.
  const chooseDirections = async () => {
    const { lat, lon } = data.address.location;
    const googleWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    const candidates = [
      Platform.OS === "ios" && {
        text: t("mapApple"),
        scheme: "maps://",
        url: `maps://?daddr=${lat},${lon}`,
      },
      {
        text: t("mapGoogle"),
        scheme: "comgooglemaps://",
        url: `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`,
        web: googleWeb,
      },
      {
        text: t("mapWaze"),
        scheme: "waze://",
        url: `waze://?ll=${lat},${lon}&navigate=yes`,
      },
    ].filter(Boolean) as {
      text: string;
      scheme: string;
      url: string;
      web?: string;
    }[];

    const buttons: AlertButton[] = [];
    for (const c of candidates) {
      const installed = await Linking.canOpenURL(c.scheme).catch(() => false);
      if (installed) {
        buttons.push({ text: c.text, onPress: () => openExternal(c.url) });
      } else if (c.web) {
        buttons.push({ text: c.text, onPress: () => openExternal(c.web!) });
      }
    }
    // Safety net: always leave at least the web map.
    if (buttons.length === 0) {
      buttons.push({
        text: t("mapGoogle"),
        onPress: () => openExternal(googleWeb),
      });
    }
    buttons.push({ text: t("cancel"), style: "cancel" });

    customAlert(t("mapChooserTitle"), t("mapChooserMessage"), buttons);
  };

  type Action = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    url?: string;
    inApp?: boolean; // web links open in the in-app browser
    onPress?: () => void; // overrides url-based opening (confirm / chooser)
  };
  // Web links (present-only) — their own "Links" section.
  const linkActions: Action[] = [
    data.websiteUrl && {
      icon: "globe-outline",
      label: t("actionWebsite"),
      url: data.websiteUrl,
      inApp: true,
    },
    data.menuUrl && {
      icon: "restaurant-outline",
      label: t("actionMenu"),
      url: data.menuUrl,
      inApp: true,
    },
    data.reservationUrl && {
      icon: "calendar-outline",
      label: t("actionReserve"),
      url: data.reservationUrl,
      inApp: true,
    },
  ].filter(Boolean) as Action[];

  // Contact actions — ways to reach the business: phone, email, Instagram
  // (present-only). Directions is NOT here — it lives with the map in Location.
  const contactActions: Action[] = [
    data.phoneNumber && {
      icon: "call-outline",
      label: t("actionCall"),
      url: `tel:${data.phoneNumber}`,
    },
    data.contactEmail && {
      icon: "mail-outline",
      label: t("actionEmail"),
      onPress: () => confirmOpenEmail(data.contactEmail!),
    },
    data.instagramTag && {
      icon: "logo-instagram",
      label: `@${data.instagramTag}`,
      onPress: () => confirmOpenInstagram(data.instagramTag!),
    },
  ].filter(Boolean) as Action[];

  // ---- render -----------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={data.name}
        showBack
        subheading={typeName(data.type.slug)}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: ctaBarHeight + spacing.xl }}
      >
        {/* No horizontal padding here — the photo strip spans full width; every
            other block insets itself with marginHorizontal: layout.screenPadding. */}
        <View style={{ paddingTop: spacing.lg, gap: spacing.xl }}>
          {/* ---- Media: contained banner + full-width photo strip ---- */}
          <View style={{ gap: spacing.xs }}>
            {/* Banner — contained; CustomMedia owns the tap → opens the gallery. */}
            <View
              style={{
                marginHorizontal: layout.screenPadding,
                aspectRatio: data.banner.aspectRatio,
                borderRadius: radius.structure,
                overflow: "hidden",
                boxShadow: shadow.card,
              }}
            >
              <CustomMedia
                media={data.banner}
                disableFullscreenPreview
                onPress={() => setGalleryIndex(0)}
                style={{ flex: 1 }}
                backgroundColor={color.brand}
              />
            </View>

            {/* Photos — full-width strip, inset to line up with the banner; each
                keeps its aspect ratio. The lg content padding gives shadow.card's
                outer layer (0 4px 14px → ~18px past the box) room inside the
                clipping ScrollView; the negative margin pulls the visual rhythm
                back to the original sm, so the layout is unchanged. */}
            {data.photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: spacing.sm - spacing.lg }}
                contentContainerStyle={{
                  gap: spacing.sm,
                  paddingHorizontal: layout.screenPadding,
                  paddingVertical: spacing.lg,
                }}
              >
                {data.photos.map((photo, i) => (
                  <View
                    key={`photo-${i}`}
                    style={{
                      height: thumbHeight,
                      aspectRatio: photo.aspectRatio,
                      borderRadius: radius.structure,
                      overflow: "hidden",
                      boxShadow: shadow.card,
                    }}
                  >
                    <CustomMedia
                      media={photo}
                      disableFullscreenPreview
                      onPress={() => setGalleryIndex(i + 1)}
                      style={{ flex: 1 }}
                      backgroundColor={color.brand}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ---- Identity: name · type · subsidized · handle ---- */}
          <View
            style={{ marginHorizontal: layout.screenPadding, gap: spacing.xs }}
          >
            <Text style={[text.title, { color: color.text.primary }]}>
              {data.name}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {/* Business type — same font/size/color as the IG handle below. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Ionicons
                  name="storefront-outline"
                  size={15}
                  color={color.text.secondary}
                />
                <Text style={[text.label, { color: color.text.secondary }]}>
                  {typeName(data.type.slug)}
                </Text>
              </View>

              {data.isSubsidizedByPlatform && (
                <Text style={[text.caption, { color: color.text.tertiary }]}>
                  {t("subsidized")}
                </Text>
              )}
            </View>
          </View>

          {/* ---- Reward (the motivator) — prominent hero card; tap for the
              "what affects your reward" explainer. ---- */}
          {hasReward ? (
            <Pressable
              onPress={() => setRewardInfoOpen(true)}
              accessibilityRole="button"
              style={({ pressed, hovered }) => [
                {
                  marginHorizontal: layout.screenPadding,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: color.surface,
                  borderRadius: radius.structure,
                  padding: layout.cardPadding,
                  boxShadow: shadow.card,
                },
                pressFeedbackStyle({ pressed, hovered }),
              ]}
            >
              {/* Icon medallion — a success-tinted ✨, matching the share card. */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(color.success, 0.14),
                }}
              >
                <Ionicons name="sparkles" size={22} color={color.success} />
              </View>

              <View style={{ flex: 1, gap: spacing.xs / 2 }}>
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {/* Budget-capped → "Earn up to" (the affordable payout is an
                      upper bound on a shared budget); uncapped → "Earn around". */}
                  {t(
                    data.isRewardCapped
                      ? "rewardEyebrowCapped"
                      : "rewardEyebrow",
                  )}
                </Text>
                <Text style={[text.amountLg, { color: color.success }]}>
                  {formatBudget(data.estimatedRewardCents!)}
                </Text>
                <Text
                  style={[
                    text.caption,
                    // Pull the sub-line up into the big number's line-box descent
                    // so the gap below the amount matches the gap above it.
                    { color: color.text.secondary, marginTop: -spacing.sm },
                  ]}
                >
                  {t("rewardSentenceNoReach")}
                  {data.estimatedAverageReach !== null
                    ? " " +
                      noBreak(
                        t("rewardReachSuffix", {
                          reach: data.estimatedAverageReach.toLocaleString(),
                        }),
                      )
                    : ""}
                </Text>
              </View>

              <Ionicons
                name="information-circle-outline"
                size={20}
                color={color.text.tertiary}
              />
            </Pressable>
          ) : isCalculating ? (
            <View
              style={{
                marginHorizontal: layout.screenPadding,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.card,
              }}
            >
              <RewardCalculatingIndicator />
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("calculating")}
              </Text>
            </View>
          ) : null}

          {/* ---- Ending-soon scarcity notice — danger-tinted block with an
              hourglass, shown when the business is running low on budget and
              may disappear (never for subsidized/PAYG). The one deliberate
              non-error use of the danger family (see the design-system color
              rules). ---- */}
          {data.isLowBudget && (
            <View
              style={{
                marginHorizontal: layout.screenPadding,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.sm,
                backgroundColor: color.dangerBg,
                borderRadius: radius.structure,
                padding: layout.cardPadding,
                boxShadow: shadow.chip,
              }}
            >
              <Ionicons
                name="hourglass-outline"
                size={18}
                color={color.on.dangerBg}
              />
              <Text
                style={[text.caption, { color: color.on.dangerBg, flex: 1 }]}
              >
                {t("lowBudgetNotice")}
              </Text>
            </View>
          )}

          {/* ---- Reward influenced by (bullets, below the reward card) ---- */}
          {rewardMessages.length > 0 && (
            <Section title={t("rewardInfluencedBy")} text={text} color={color}>
              <View style={{ gap: spacing.xs }}>
                {rewardMessages.map((msg, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={color.text.tertiary}
                    />
                    <Text
                      style={[
                        text.body,
                        { color: color.text.secondary, flex: 1 },
                      ]}
                    >
                      {msg}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ---- About (above the links) ---- */}
          {data.description && (
            <Section title={t("about")} text={text} color={color}>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {data.description}
              </Text>
            </Section>
          )}

          {/* ---- Contact — call / email / Instagram (present-only) ---- */}
          {contactActions.length > 0 && (
            <Section title={t("contactTitle")} text={text} color={color}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {contactActions.map((a) => (
                  <Chip
                    key={a.label}
                    icon={a.icon}
                    label={a.label}
                    onPress={() => {
                      if (a.onPress) a.onPress();
                      else if (a.url)
                        a.inApp ? openInApp(a.url) : openExternal(a.url);
                    }}
                  />
                ))}
              </View>
            </Section>
          )}

          {/* ---- Links — website / menu / reservation (approved only) ---- */}
          {linkActions.length > 0 && (
            <Section title={t("linksTitle")} text={text} color={color}>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {linkActions.map((a) => (
                  <Chip
                    key={a.label}
                    icon={a.icon}
                    label={a.label}
                    onPress={() => {
                      if (a.onPress) a.onPress();
                      else if (a.url)
                        a.inApp ? openInApp(a.url) : openExternal(a.url);
                    }}
                  />
                ))}
              </View>
            </Section>
          )}

          {/* ---- Tags — keywords, at least one must show in the story ---- */}
          {data.tags.length > 0 && (
            <Section title={t("tagsTitle")} text={text} color={color}>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("tagsHint")}
              </Text>
              {/* Tap or hold a tag to copy it. */}
              <BusinessTagChips tags={data.tags} />
            </Section>
          )}

          {/* ---- Opening hours (client-computed "open now") ---- */}
          {data.openingHours.length > 0 && (
            <Section
              title={t("hours")}
              text={text}
              color={color}
              right={
                openNow !== null ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.pill,
                        backgroundColor: openNow ? color.success : color.danger,
                      }}
                    />
                    <Text
                      style={[
                        text.label,
                        {
                          color: openNow ? color.success : color.text.secondary,
                        },
                      ]}
                    >
                      {openNow ? t("openNow") : t("closedNow")}
                    </Text>
                  </View>
                ) : undefined
              }
            >
              <View
                style={{
                  backgroundColor: color.surface,
                  borderRadius: radius.structure,
                  padding: layout.cardPadding,
                  boxShadow: shadow.card,
                  gap: spacing.sm,
                }}
              >
                {dayOrder.map((day) => {
                  const intervals = data.openingHours.filter(
                    (p) => p.dayOfWeek === day,
                  );
                  return (
                    <View
                      key={day}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={[text.body, { color: color.text.primary }]}>
                        {dayLabels[day]}
                      </Text>
                      <Text
                        style={[text.body, { color: color.text.secondary }]}
                      >
                        {intervals.length === 0
                          ? t("closedDay")
                          : intervals
                              .map((p) => formatInterval(p, t("open24")))
                              .join(", ")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Section>
          )}

          {/* ---- Location (distance shown alongside the address) ---- */}
          <Section
            title={t("location")}
            text={text}
            color={color}
            right={
              distanceText ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={color.text.tertiary}
                  />
                  <Text style={[text.caption, { color: color.text.secondary }]}>
                    {distanceText}
                  </Text>
                </View>
              ) : undefined
            }
          >
            {/* Map preview — non-interactive, the unselected marker; the overlay
                makes a tap open the directions chooser. Address sits below it. */}
            <View
              style={[
                {
                  height: 160,
                  borderRadius: radius.structure,
                  overflow: "hidden",
                  boxShadow: shadow.card,
                },
                pressFeedbackStyle({ pressed: mapPressed }),
              ]}
            >
              <MapView
                style={{ flex: 1 }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                initialRegion={{
                  latitude: data.address.location.lat,
                  longitude: data.address.location.lon,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: data.address.location.lat,
                    longitude: data.address.location.lon,
                  }}
                  // anchor = Android (Google Maps); centerOffset = iOS (Apple
                  // Maps) — each platform reads only its own prop. Both put
                  // the pointer tip on the coordinate.
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: -markerHeight / 2 }}
                >
                  {/* Custom marker view is iOS-only — Android renders custom
                      marker children clipped/blank under the New Architecture
                      (react-native-maps #5877), so it keeps the default pin.
                      Same decision as BusinessMap's MarkerItem — see the
                      comment there before re-attempting. */}
                  {Platform.OS === "ios" && (
                    <MapMarkerComponent
                      local={data}
                      isSelected={false}
                      onHeight={setMarkerHeight}
                    />
                  )}
                </Marker>
              </MapView>
              <Pressable
                onPress={chooseDirections}
                onPressIn={() => setMapPressed(true)}
                onPressOut={() => setMapPressed(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
            </View>

            {/* Address on the left, directions chip on the opposite side —
                bottom-aligned so the chip sits by the last address line. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <Text
                style={[text.caption, { color: color.text.secondary, flex: 1 }]}
              >
                {[
                  data.address.street,
                  `${data.address.zip} ${data.address.city}`,
                  data.address.region,
                  data.address.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
              <Chip
                icon="navigate-outline"
                label={t("actionDirections")}
                onPress={chooseDirections}
              />
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* ---- Pinned "Earn here" CTA (bar carries the top shadow). A business
          that fails the accessibility rule (out of budget / allowance) can
          still be opened from the visited list or an old share, but a share
          created now would be rejected (4003) AFTER the story is public — so
          the CTA is replaced with an honest notice instead. ---- */}
      <BottomActionBar onHeightChange={setCtaBarHeight}>
        {data.isAccessible ? (
          <CustomButton
            type="primary"
            label={t("earnHere")}
            icon="sparkles"
            onPress={() =>
              router.push({
                pathname: "/shares/create",
                params: { businessUid: uid, businessName: data.name },
              })
            }
          />
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              paddingVertical: spacing.sm,
            }}
          >
            <Ionicons
              name="hourglass-outline"
              size={18}
              color={color.text.secondary}
            />
            <Text style={[text.caption, { color: color.text.secondary, flex: 1 }]}>
              {t("notAccessibleNotice")}
            </Text>
          </View>
        )}
      </BottomActionBar>

      {/* ---- Fullscreen swipeable gallery (banner + photos) ----
          Rendered only while open so it remounts each time (resets the pager). */}
      {galleryIndex !== null && (
        <FullscreenMediaGallery
          media={galleryMedia}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}

      <RewardInfoSheet
        open={rewardInfoOpen}
        onClose={() => setRewardInfoOpen(false)}
      />
    </View>
  );
}

/** A pill chip for a contact / link / IG action (surface + chip shadow). */
function Chip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          minHeight: layout.minTapTarget,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: color.surface,
          boxShadow: shadow.chip,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name={icon} size={16} color={color.ink} />
      <Text style={[text.label, { color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** A titled content section (screen-edge inset) with an optional right control. */
function Section({
  title,
  right,
  children,
  text,
  color,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  text: ReturnType<typeof useTheme>["theme"]["text"];
  color: ReturnType<typeof useTheme>["theme"]["color"];
}) {
  return (
    <View style={{ marginHorizontal: layout.screenPadding, gap: spacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[text.heading, { color: color.text.primary }]}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

// ---- opening-hours helpers -----------------------------------------------
// "Open now" is computed by the shared `isBusinessOpenNow` (@tagly/client);
// only the localized interval label is screen-specific (it needs `t()` copy).

/** An opening-hours interval, localized (English 12h, Czech 24h) via `formatTimeOfDay`. */
function formatInterval(p: OpeningHoursPeriod, open24Label: string): string {
  if (p.openMinute === 0 && p.closeMinute === 1440) return open24Label;
  return `${formatTimeOfDay(p.openMinute)} - ${formatTimeOfDay(p.closeMinute)}`;
}
