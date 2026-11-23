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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import {
  TopMenu,
  useTheme,
  useCatalogLocalizer,
  formatTimeOfDay,
  pressFeedbackStyle,
  customAlert,
  withAlpha,
  spacing,
  layout,
  type AlertButton,
} from "@tagly/client";
import MapView, { Marker } from "react-native-maps";
import { CustomMedia } from "@tagly/client/components/media/CustomMedia";
import type { CustomMediaType } from "@tagly/client/components/media/CustomMedia";
import { FullscreenMediaGallery } from "@tagly/client/components/media/FullscreenMediaGallery";
import type {
  BusinessOwnerDetails,
  BusinessOwnerLink,
} from "@tagly/models/v2/advertiserApp";
import { BannedBusinessNotice } from "@/components/businesses/BannedBusinessNotice";
import { useBusiness } from "@/hooks/details/useBusiness";

type OpeningPeriod = BusinessOwnerDetails["openingHours"][number];

/**
 * Business detail screen (`/businesses/:uid`) — the advertiser's OWN business
 * page, in full. The owner twin of the customer's business detail, with two
 * owner-specific differences:
 *
 *  - **Show everything, mark the gaps.** Every profile field renders. The ones
 *    the owner hasn't filled in (description, Instagram, phone, email, each web
 *    link, opening hours) appear as a dashed "Add …" affordance — a nudge to
 *    complete the page. Tapping one deep-links into the details edit form
 *    (`promptEdit` → `/businesses/:uid/settings/details?focus=<field>`), and
 *    the top bar's edit action opens the page's settings hub.
 *  - **Links carry moderation status.** The owner sees every link regardless of
 *    status (unlike customers, who only see APPROVED ones), each with a
 *    PENDING / APPROVED / REJECTED pill + its url.
 *
 * Deliberately DROPS the customer-sharer bits (reward estimate, "reward
 * influenced by", low-budget notice, distance-from-me, "Earn here" CTA). The
 * scroll body has no horizontal padding — the photo strip spans full width and
 * every other block insets itself with `marginHorizontal: layout.screenPadding`.
 * Contact / Instagram / Links are three separate sections.
 */
export default function BusinessDetailsScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { t } = useTranslation("businessDetails");
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { typeName } = useCatalogLocalizer();

  const query = useBusiness(uid ?? "", router);
  const data = query.data;
  const isLoading = query.isLoading;
  const isError = query.isError;

  // Index into [banner, ...photos] currently open in the fullscreen gallery.
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  // The map preview's overlay drives this so the whole card shows press feedback.
  const [mapPressed, setMapPressed] = useState(false);
  // Rendered height of the map pin (bubble + stem). iOS (Apple Maps) ignores
  // `anchor` for custom marker views and positions by `centerOffset` instead —
  // without the lift the pin centers on the coordinate and its tip points
  // ~half the pin below the true spot. Seeded near the real size; the pin
  // view's onLayout corrects it.
  const [pinHeight, setPinHeight] = useState(41);

  // In-app browser for web links; the OS handler for tel:/mailto:/maps/IG.
  const openInApp = (url: string) =>
    WebBrowser.openBrowserAsync(url).catch(() => {});
  const openExternal = (url: string) => Linking.openURL(url).catch(() => {});

  // A "missing field" tap deep-links into the details edit form with that
  // section's chip already revealed (media prompts would go to the media
  // screen, but every current prompt is a details field). A BANNED page is
  // read-only — the prompt explains instead of opening a form whose save
  // would refuse.
  const promptEdit = (
    focus:
      | "description"
      | "instagram"
      | "phone"
      | "email"
      | "website"
      | "menu"
      | "reservation"
      | "hours",
  ) => {
    if (data?.status === "BANNED") {
      customAlert(t("bannedEditTitle"), t("bannedEditBody"));
      return;
    }
    router.push(`/businesses/${uid}/settings/details?focus=${focus}`);
  };

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
  const openNow = isOpenNow(data.openingHours, data.timezone);
  // CZ weeks start on Monday; US on Sunday.
  const cs = dayjs.locale() === "cs";
  const dayOrder = cs ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
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

  // The three web links, in display order, with their per-type copy.
  const linkRows: {
    key: string;
    label: string;
    addLabel: string;
    link: BusinessOwnerLink | null;
  }[] = [
    {
      key: "website",
      label: t("actionWebsite"),
      addLabel: t("addWebsite"),
      link: data.websiteLink,
    },
    {
      key: "menu",
      label: t("actionMenu"),
      addLabel: t("addMenu"),
      link: data.menuLink,
    },
    {
      key: "reservation",
      label: t("actionReserve"),
      addLabel: t("addReservation"),
      link: data.reservationLink,
    },
  ];

  // ---- render -----------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={data.name}
        showBack
        subheading={typeName(data.type.slug)}
        // A BANNED page is read-only for its owner — no edit door (the
        // suspended notice below explains why).
        rightAction={
          data.status === "BANNED"
            ? undefined
            : {
                icon: "create-outline",
                onPress: () => router.push(`/businesses/${uid}/settings`),
                accessibilityLabel: t("editAction"),
              }
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* No horizontal padding here — the photo strip spans full width; every
            other block insets itself with marginHorizontal: layout.screenPadding. */}
        <View style={{ paddingTop: spacing.lg, gap: spacing.xl }}>
          {data.status === "BANNED" && (
            <View style={{ marginHorizontal: layout.screenPadding }}>
              <BannedBusinessNotice />
            </View>
          )}
          {/* ---- Media: contained banner + full-width photo strip ---- */}
          <View style={{ gap: spacing.xs }}>
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

            {data.photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                // A horizontal ScrollView clips at its own bounds, and
                // shadow.card's outer layer (0 4px 14px) reaches ~18px past a
                // card — so the content carries lg padding as shadow room, and
                // the negative margin pulls the same visual rhythm back to the
                // original sm. Net layout unchanged, shadow unclipped.
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

          {/* ---- Identity: name · type ---- */}
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
          </View>

          {/* ---- About (present, or a dashed prompt) ---- */}
          <Section title={t("about")} text={text} color={color}>
            {data.description ? (
              <Text style={[text.body, { color: color.text.secondary }]}>
                {data.description}
              </Text>
            ) : (
              <AddRow label={t("addDescription")} onPress={() => promptEdit("description")} />
            )}
          </Section>

          {/* ---- Contact — call / email / Instagram (add prompts for gaps).
              Directions is NOT here — it lives with the map in Location. ---- */}
          <Section title={t("contactTitle")} text={text} color={color}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {data.phoneNumber ? (
                <ActionChip
                  icon="call-outline"
                  label={t("actionCall")}
                  onPress={() => openExternal(`tel:${data.phoneNumber}`)}
                />
              ) : (
                <AddChip label={t("addPhone")} onPress={() => promptEdit("phone")} />
              )}
              {data.contactEmail ? (
                <ActionChip
                  icon="mail-outline"
                  label={t("actionEmail")}
                  onPress={() => confirmOpenEmail(data.contactEmail!)}
                />
              ) : (
                <AddChip label={t("addEmail")} onPress={() => promptEdit("email")} />
              )}
              {data.instagramTag ? (
                <ActionChip
                  icon="logo-instagram"
                  label={`@${data.instagramTag}`}
                  onPress={() => confirmOpenInstagram(data.instagramTag!)}
                />
              ) : (
                <AddChip label={t("addInstagram")} onPress={() => promptEdit("instagram")} />
              )}
            </View>
          </Section>

          {/* ---- Links — website / menu / reservation, each with status ---- */}
          <Section title={t("linksTitle")} text={text} color={color}>
            <View style={{ gap: spacing.sm }}>
              {linkRows.map((row) =>
                row.link ? (
                  <LinkRow
                    key={row.key}
                    label={row.label}
                    link={row.link}
                    onPress={() => openInApp(row.link!.url)}
                  />
                ) : (
                  <AddRow
                    key={row.key}
                    label={row.addLabel}
                    onPress={() =>
                      promptEdit(
                        row.key as "website" | "menu" | "reservation",
                      )
                    }
                  />
                ),
              )}
            </View>
          </Section>

          {/* ---- Tags — what a customer's story must show (always populated:
              the name is always included, so there's no missing state) ---- */}
          {data.tags.length > 0 && (
            <Section title={t("tagsTitle")} text={text} color={color}>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("tagsHint")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {data.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.pill,
                      backgroundColor: color.accent,
                      boxShadow: shadow.chip,
                    }}
                  >
                    <Text style={[text.label, { color: color.on.accent }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ---- Opening hours (present, or a dashed prompt) ---- */}
          <Section
            title={t("hours")}
            text={text}
            color={color}
            right={
              data.openingHours.length > 0 && openNow !== null ? (
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
            {data.openingHours.length > 0 ? (
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
            ) : (
              <AddRow label={t("addHours")} onPress={() => promptEdit("hours")} />
            )}
          </Section>

          {/* ---- Location (map + full address) ---- */}
          <Section title={t("location")} text={text} color={color}>
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
                  // the stem tip on the coordinate.
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: -pinHeight / 2 }}
                >
                  {/* Simple business pin — an ink teardrop with a storefront
                      glyph (no reward semantics; this is the owner's own page).
                      iOS-only — Android renders custom marker children
                      clipped/blank under the New Architecture
                      (react-native-maps #5877), so it keeps the default pin.
                      Same decision as BusinessMap's MarkerItem — see the
                      comment there before re-attempting. */}
                  {Platform.OS === "ios" && (
                    <View
                      style={{ alignItems: "center" }}
                      onLayout={(e) =>
                        setPinHeight(e.nativeEvent.layout.height)
                      }
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: radius.pill,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: color.ink,
                          boxShadow: shadow.card,
                        }}
                      >
                        <Ionicons
                          name="storefront"
                          size={17}
                          color={color.on.ink}
                        />
                      </View>
                      <View
                        style={{
                          width: 3,
                          height: 8,
                          marginTop: -1,
                          borderRadius: radius.pill,
                          backgroundColor: color.ink,
                        }}
                      />
                    </View>
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
              <ActionChip
                icon="navigate-outline"
                label={t("actionDirections")}
                onPress={chooseDirections}
              />
            </View>
          </Section>
        </View>
      </ScrollView>

      {galleryIndex !== null && (
        <FullscreenMediaGallery
          media={galleryMedia}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </View>
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

/** Shared style for a tappable surface row (link / IG). */
function rowCardStyle(
  color: ReturnType<typeof useTheme>["theme"]["color"],
  radius: ReturnType<typeof useTheme>["theme"]["radius"],
  shadow: ReturnType<typeof useTheme>["theme"]["shadow"],
) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
    minHeight: layout.minTapTarget,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.sm,
    borderRadius: radius.structure,
    backgroundColor: color.surface,
    boxShadow: shadow.card,
  };
}

/** A solid contact chip that opens something (call / email / directions). */
function ActionChip({
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

/** A dashed "add this" chip (contact fields the owner hasn't filled in). */
function AddChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const { color, text, radius } = theme;
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
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: color.border.strong,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name="add" size={16} color={color.text.tertiary} />
      <Text style={[text.label, { color: color.text.secondary }]}>{label}</Text>
    </Pressable>
  );
}

/** A dashed full-width "add this" row (description / IG / links / hours). */
function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const { color, text, radius } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: layout.minTapTarget,
          paddingHorizontal: layout.cardPadding,
          paddingVertical: spacing.sm,
          borderRadius: radius.structure,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: color.border.strong,
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Ionicons name="add" size={18} color={color.text.tertiary} />
      <Text style={[text.body, { color: color.text.secondary, flex: 1 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A filled link row — type label + url, with its moderation-status pill. */
function LinkRow({
  label,
  link,
  onPress,
}: {
  label: string;
  link: BusinessOwnerLink;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, radius, shadow } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        rowCardStyle(color, radius, shadow),
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {label}
        </Text>
        <Text
          style={[text.caption, { color: color.text.tertiary }]}
          numberOfLines={1}
        >
          {link.url}
        </Text>
      </View>
      <LinkStatusPill status={link.status} />
    </Pressable>
  );
}

/** The PENDING / APPROVED / REJECTED pill on a link row. */
function LinkStatusPill({ status }: { status: BusinessOwnerLink["status"] }) {
  const { t } = useTranslation("businessDetails");
  const { theme } = useTheme();
  const { color, text, radius } = theme;

  const map = {
    APPROVED: {
      bg: withAlpha(color.success, 0.14),
      fg: color.success,
      label: t("linkStatusApproved"),
    },
    PENDING: {
      bg: withAlpha(color.text.tertiary, 0.12),
      fg: color.text.secondary,
      label: t("linkStatusPending"),
    },
    REJECTED: {
      bg: color.dangerBg,
      fg: color.on.dangerBg,
      label: t("linkStatusRejected"),
    },
  } as const;
  const s = map[status];

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: s.bg,
      }}
    >
      <Text style={[text.micro, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

// ---- opening-hours helpers (client-side "open now") ----------------------
// dayOfWeek: 0=Sun…6=Sat; minutes from local midnight; closeMinute<=openMinute
// means the interval closes the next day (overnight). See OpeningHoursPeriod.

/** Current weekday + minutes-from-midnight in an IANA timezone, or null. */
function nowInTimezone(
  timeZone: string,
): { weekday: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const names: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const wd = names[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hour =
      Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (wd === undefined) return null;
    return { weekday: wd, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/** True/false if the business is open right now, or null if undeterminable. */
function isOpenNow(periods: OpeningPeriod[], timeZone: string): boolean | null {
  const now = nowInTimezone(timeZone);
  if (!now) return null;
  const prevDay = (now.weekday + 6) % 7;
  for (const p of periods) {
    const overnight = p.closeMinute <= p.openMinute;
    if (p.dayOfWeek === now.weekday) {
      if (overnight) {
        if (now.minutes >= p.openMinute) return true; // open into tomorrow
      } else if (now.minutes >= p.openMinute && now.minutes < p.closeMinute) {
        return true;
      }
    }
    // An overnight interval that started yesterday and hasn't closed yet.
    if (p.dayOfWeek === prevDay && overnight && now.minutes < p.closeMinute) {
      return true;
    }
  }
  return false;
}

/** An opening-hours interval, localized (English 12h, Czech 24h) via `formatTimeOfDay`. */
function formatInterval(p: OpeningPeriod, open24Label: string): string {
  if (p.openMinute === 0 && p.closeMinute === 1440) return open24Label;
  return `${formatTimeOfDay(p.openMinute)} - ${formatTimeOfDay(p.closeMinute)}`;
}
