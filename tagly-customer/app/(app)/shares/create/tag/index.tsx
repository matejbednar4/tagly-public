import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BottomActionBar,
  BusinessTagChips,
  CustomButton,
  SupportSheet,
  TopMenu,
  useTheme,
} from "@tagly/client";
import { useBusiness } from "@/hooks/details/useBusiness";

/**
 * Share-create · tag guidance — reached when a create-share attempt is rejected
 * because the story didn't clearly tag the business (backend error 4100). It
 * explains that the story has to clearly show one of the business's names / its
 * Instagram handle for the post to verify, lists those required tags as chips
 * (same as the picker — tap or hold one to copy it), and sends the user back to
 * the picker to choose another
 * story (the confirm step `router.replace`d into here, so "back" lands on the
 * picker, not the consumed confirm screen). A secondary "contact support" action
 * opens the shared support sheet for anyone who thinks the rejection is wrong.
 *
 * Below the chips sits the "already tagged it?" tip, which exists because it is
 * the single most common support email on this screen: the customer DID tag the
 * business, but the sticker was tiny or low-contrast (white on white), so the
 * verifier never read it. Re-posting with a bigger, clearly visible tag fixes
 * nearly all of them, so the screen says that before anyone writes in.
 *
 * Layout mirrors the confirm screen: the explanation scrolls (and centers when
 * short) while the two actions float in a pinned bottom bar.
 */
export default function CreateShareTagScreen() {
  const { t } = useTranslation("createShareTag");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const router = useRouter();

  const { businessUid, businessName } = useLocalSearchParams<{
    businessUid: string;
    businessName?: string;
    storyId?: string;
  }>();
  const businessLabel = businessName || t("thisBusiness");

  // The business's matchable names (name + alternative names + @handle) — a story
  // must clearly show at least one. ETag-cached, usually warm from the picker.
  const businessQuery = useBusiness(businessUid, router, {
    enabled: !!businessUid,
  });
  const requiredTags = businessQuery.data?.tags ?? [];
  // Until the (usually warm) business fetch settles, hold the body copy + chips
  // and show a spinner — otherwise the screen briefly asserts the wrong guidance
  // ("noTags") with no chips before the tags arrive.
  const tagsLoading = !!businessUid && businessQuery.isLoading;

  const [supportOpen, setSupportOpen] = useState(false);
  // The pinned action bar overlays the scroll; measure it so the content clears it.
  const [actionBarHeight, setActionBarHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("topTitle")}
        subheading={businessLabel}
        showBack
        hideMenu
      />

      {/* Explanation scrolls (and centers when short); the actions float over it. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: actionBarHeight + spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 104,
            height: 104,
            borderRadius: radius.pill,
            backgroundColor: color.brand,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow.card,
          }}
        >
          <Ionicons name="pricetags" size={48} color={color.ink} />
        </View>

        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <Text
            style={[
              text.title,
              { color: color.text.primary, textAlign: "center" },
            ]}
          >
            {t("heading", { business: businessLabel })}
          </Text>
          {!tagsLoading && (
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {requiredTags.length > 0 ? t("body") : t("noTags")}
            </Text>
          )}
        </View>

        {/* Required tags — a story must clearly show at least one. While the
            business loads, a spinner stands in so we don't flash wrong copy. */}
        {tagsLoading ? (
          <ActivityIndicator
            color={color.text.tertiary}
            style={{ alignSelf: "center" }}
          />
        ) : (
          <BusinessTagChips tags={requiredTags} align="center" />
        )}

        {/* "Already tagged it?" — the size/contrast tip. Held back while the
            business loads so the screen doesn't shift under the user. */}
        {!tagsLoading && (
          <View
            style={{
              flexDirection: "row",
              // Multi-line body: the glyph pins to the first line, not the middle.
              alignItems: "flex-start",
              gap: spacing.md,
              padding: layout.cardPadding,
              borderRadius: radius.structure,
              backgroundColor: color.surface,
              boxShadow: shadow.card,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color.brand,
              }}
            >
              <Ionicons name="eye-outline" size={18} color={color.on.brand} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {t("tipTitle")}
              </Text>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("tipBody")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Pinned action bar (carries the top shadow); buttons stay flat inside. */}
      <BottomActionBar onHeightChange={setActionBarHeight} gap={spacing.lg}>
        <CustomButton
          type="primary"
          label={t("tryAnother")}
          icon="arrow-back"
          onPress={() => router.back()}
        />
        <CustomButton
          type="soft"
          label={t("contactSupport")}
          icon="chatbubble-ellipses-outline"
          onPress={() => setSupportOpen(true)}
        />
      </BottomActionBar>

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        context="share-not-tagged"
      />
    </View>
  );
}
