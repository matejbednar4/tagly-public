import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Trans, useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BottomActionBar,
  CustomButton,
  openTermsOfMonetization,
  PressableText,
  pressFeedbackStyle,
  showToast,
  TopMenu,
  useTheme,
  withAlpha,
} from "@tagly/client";
import { useBusiness } from "@/hooks/details/useBusiness";
import { useCreateShare } from "@/hooks/useCreateShare";
import { useAnalytics, type ShareCreateSource } from "@/utils/analytics";

/**
 * Share-create · step 2 — confirm + agree before monetizing the picked story.
 *
 * Reached from the story picker's "Continue" with the target business
 * (`businessUid` + `businessName`) and the chosen story (`storyId`). Two short,
 * icon-led sections do the talking instead of a wall of text: section 1 (positive)
 * says who pays for authentic promotion (the business, or **Tagly** when the
 * business is platform-subsidized) and that the story must genuinely be about them;
 * section 2 (danger-toned) names the consequences of gaming it (no reward, rating
 * drop, and in bold, an eventual ban). The explanation scrolls; the explicit
 * consent checkbox (shown in every locale, with a "Terms of Monetization" link)
 * and the primary CTA float over it in a pinned bottom bar, same as the business
 * detail page.
 *
 * Submitting POSTs `{ businessUid, storyId, agreedToTermsOfMonetization: true }`
 * to the v2 create-share endpoint (the backend reads the actual media from the
 * live story). On success the share is created PENDING admin review; we drop the
 * monetized story from the picker's stories cache (so it can't be picked again),
 * then exit the whole create flow back to the tabs and open the new share's detail
 * — so "back" from details lands on the account hub, not the consumed flow. Error
 * codes are mapped to actionable copy: the most important is **4100** ("story
 * doesn't clearly tag this business") → it routes to the `shares/create/tag`
 * guidance screen instead of an alert. Transport/validation/rate-limit/ban errors
 * (codes < 1000 + the two ban codes) are left to `callAuthed`'s central handler —
 * including the 429 from this endpoint's own per-user limiter, which it surfaces as
 * a timed "try again in N" alert.
 */
export default function ConfirmShareScreen() {
  const { t } = useTranslation("confirmShare");
  const { theme } = useTheme();
  const { color, text, radius, shadow, spacing, layout } = theme;
  const router = useRouter();

  const {
    businessUid,
    businessName,
    storyId,
    source: sourceParam,
  } = useLocalSearchParams<{
    businessUid: string;
    businessName?: string;
    storyId: string;
    source?: ShareCreateSource;
  }>();
  // Name to interpolate into the copy (falls back if the param is missing).
  const businessLabel = businessName || t("thisBusiness");
  // Origin surface, threaded through the create flow (defaults to a direct picker
  // entry when not passed).
  const source: ShareCreateSource = sourceParam ?? "picker";

  // Whether the platform (not the business) funds this business's rewards — flips
  // section 1 from "{business} pays you" to "Tagly pays you". ETag-cached, usually
  // warm from the picker the user just came through.
  const businessQuery = useBusiness(businessUid, router, {
    enabled: !!businessUid,
  });
  const isSubsidized = businessQuery.data?.isSubsidizedByPlatform ?? false;

  // Confirm/consent step of the share funnel — fire once on mount.
  const { track } = useAnalytics();
  const viewTracked = useRef(false);
  useEffect(() => {
    if (businessUid && !viewTracked.current) {
      viewTracked.current = true;
      track("share_create_confirm_viewed", { businessUid, source });
    }
  }, [businessUid, source, track]);

  const [agreed, setAgreed] = useState(false);
  // The pinned consent + CTA bar overlays the scroll; measure it so the content
  // can clear it (its height varies as the checkbox label wraps).
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const toggle = () => setAgreed((v) => !v);

  // Centralized creation (request + analytics + story-cache drop + review prompt +
  // error presentation). navigateOnError: this is the picker, so 4100 → tag screen
  // and 4106 → "pick another" (back). The screen owns only the success toast + nav.
  const { submitting, createShare } = useCreateShare();

  const handleMonetize = async () => {
    if (!agreed || submitting) return;
    if (!businessUid || !storyId) return;

    const result = await createShare({
      businessUid,
      storyId,
      source,
      businessName,
      navigateOnError: true,
    });
    // On failure the hook already showed the error (and routed 4100/4106).
    if (!result.ok) return;

    // Created (held for admin review). Exit the whole create flow back to the tabs,
    // then open the new share's detail — so "back" from details returns to the tabs
    // (account hub), not into the consumed monetization flow (picker → confirm).
    showToast({ type: "success", text1: t("successToast") });
    const share = result.data?.share;
    if (router.canDismiss()) router.dismissAll();
    if (share) {
      router.push({ pathname: "/shares/[uid]", params: { uid: share.uid } });
    }
    // The hook resets `submitting` on success too (its sheet caller never
    // unmounts), so the CTA stops spinning as the navigation starts.
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu
        title={t("topTitle")}
        subheading={businessLabel}
        showBack
        hideMenu
      />

      {/* Explanation scrolls; the consent + CTA float over it in a pinned bar. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Center the content when it's short; still scroll when it's tall.
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: actionBarHeight + spacing.xl,
          gap: spacing.xl,
        }}
      >
        <Text style={[text.title, { color: color.text.primary }]}>
          {t("heading", { business: businessLabel })}
        </Text>

        <View style={{ gap: spacing.lg }}>
          {/* Section 1 — who pays + the authenticity rule (positive). */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: color.accent,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: shadow.chip,
              }}
            >
              <Ionicons name="cash" size={20} color={color.on.accent} />
            </View>
            <Text style={[text.body, { color: color.text.secondary, flex: 1 }]}>
              {t(isSubsidized ? "section1Subsidized" : "section1", {
                business: businessLabel,
              })}
            </Text>
          </View>

          {/* Section 2 — consequences of gaming it (danger-toned, ban in bold). */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(color.danger, 0.12),
                alignItems: "center",
                justifyContent: "center",
                boxShadow: shadow.chip,
              }}
            >
              <Ionicons name="warning" size={20} color={color.danger} />
            </View>
            <Text style={[text.body, { color: color.text.secondary, flex: 1 }]}>
              {t("section2")}{" "}
              <Text style={[text.bodyMedium, { color: color.text.primary }]}>
                {t("section2Bold")}
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Pinned consent + action bar (the bar carries the top shadow). Measured
          via onLayout so the scroll content above clears it. The box must be
          ticked in every locale; tapping "Terms of Monetization" opens the web
          doc instead of toggling. */}
      <BottomActionBar onHeightChange={setActionBarHeight} gap={spacing.lg}>
        {/* The whole row toggles via a Pressable, so the press feedback is the
            usual scale/opacity — NOT a text underline (a raw <Text onPress> on the
            label underlined the text on press). The label is plain text; only the
            nested PressableText "Terms of Monetization" is its own tappable run,
            opening the doc instead of toggling. */}
        <Pressable
          onPress={toggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          hitSlop={8}
          style={({
            pressed,
            hovered,
          }: {
            pressed: boolean;
            hovered?: boolean;
          }) => [
            { flexDirection: "row", alignItems: "center", gap: spacing.md },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          {/* An input edge (border) is allowed; ticked = ink fill + on-ink check,
              same as the selected-state pattern. */}
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: radius.button,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: agreed ? color.ink : color.surface,
              borderWidth: agreed ? 0 : 1.5,
              borderColor: color.border.strong,
            }}
          >
            {agreed && (
              <Ionicons name="checkmark" size={16} color={color.on.ink} />
            )}
          </View>

          <Text style={[text.caption, { color: color.text.primary, flex: 1 }]}>
            <Trans
              t={t}
              i18nKey="agreeLabel"
              values={{ business: businessLabel }}
              components={{
                terms: (
                  <PressableText
                    onPress={openTermsOfMonetization}
                    style={text.caption}
                  />
                ),
              }}
            />
          </Text>
        </Pressable>

        <CustomButton
          type="primary"
          label={t("monetize")}
          icon="sparkles"
          disabled={!agreed}
          loading={submitting}
          onPress={handleMonetize}
        />
      </BottomActionBar>
    </View>
  );
}
