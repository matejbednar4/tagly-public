import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  callAuthed,
  pressFeedbackStyle,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { getBusinesses } from "@tagly/sdk/v2/advertiserApp";
import type { BusinessOwnerPreview } from "@tagly/models/v2/advertiserApp";
import { BusinessPreviewCard } from "@/components/businesses/BusinessPreviewCard";

/**
 * Business pages list (`/businesses`) — the settings hub's "Business pages"
 * entry. Lists the advertiser's pages full-width; tapping one opens ITS
 * settings hub (`/businesses/:uid/settings` — this list is the manage door,
 * unlike the account tab's strip which opens the page preview). A dashed add
 * row leads to the create wizard. With exactly one page the list forwards
 * straight to that page's settings on first load (no one-item list to tap
 * through); back then returns to the settings hub, not here.
 */
export default function BusinessesScreen() {
  const { t } = useTranslation("businessesList");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;

  const [businesses, setBusinesses] = useState<BusinessOwnerPreview[] | null>(
    null,
  );
  // Auto-forward only once per mount — after a back from the forwarded
  // settings screen the list must render, not bounce the user again.
  const forwardedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const res = await callAuthed(router, (jwt) => getBusinesses({ jwt }));
        if (!alive || !res.ok || !res.data) return;
        const list = res.data.businesses;
        if (list.length === 1 && !forwardedRef.current) {
          forwardedRef.current = true;
          router.replace(`/businesses/${list[0].uid}/settings`);
          return;
        }
        forwardedRef.current = true;
        setBusinesses(list);
      })();
      return () => {
        alive = false;
      };
    }, [router]),
  );

  const cardWidth = width - layout.screenPadding * 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} showBack />
      {businesses === null ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={color.text.tertiary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + layout.screenPadding,
            gap: spacing.xl,
          }}
        >
          {businesses.map((business) => (
            <BusinessPreviewCard
              key={business.uid}
              business={business}
              width={cardWidth}
              onPress={() => router.push(`/businesses/${business.uid}/settings`)}
            />
          ))}

          {/* Dashed add row — the "nothing here yet" affordance per the design
              system (dashed borders are reserved for exactly this). */}
          <Pressable
            onPress={() => router.push("/businesses/create")}
            accessibilityRole="button"
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
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
              {t("addPage")}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
