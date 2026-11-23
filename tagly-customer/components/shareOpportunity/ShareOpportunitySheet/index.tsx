import { useEffect, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomSheet,
  BusinessPreview,
  CustomButton,
  InstagramStoryPreview,
  openTermsOfMonetization,
  PressableText,
  pressFeedbackStyle,
  showToast,
  useCurrentLocation,
  useFormatBudget,
  useTheme,
} from "@tagly/client";
import type { GetShareOpportunityResponse } from "@tagly/models/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import { useCreateShare } from "@/hooks/useCreateShare";
import { useAnalytics } from "@/utils/analytics";

/**
 * The app-open "share opportunity" bottom sheet. Shown by the modal cycle in
 * `(app)/_layout.tsx` when `useShareOpportunity` detects the customer is inside a
 * shareable Tagly business. Two variants (origin/main's dropped "you posted new
 * content" scenario has no v2 business picker):
 *
 *   - `inBusiness`          → "Are you at {business}?" + the business card; the CTA
 *                             opens the normal story-picker create flow for it.
 *   - `inBusinessWithStory` → the one live story Rekognition matched, shown large
 *                             and centered with a plain-English reward line. An
 *                             explicit consent checkbox (same gate as the
 *                             create/confirm flow) enables the CTA, which creates
 *                             the share in one tap and opens its detail.
 *
 * The sheet is **not** swipe/backdrop dismissable — the customer must choose (the
 * CTA or "Not now") so the nudge is a deliberate decision, not an accidental
 * dismissal. `onClose` (from the cycle) resets the detector + clears the active
 * modal; the last non-`none` scenario is retained through the close animation so
 * the content doesn't blank as it slides away.
 */
export default function ShareOpportunitySheet({
  open,
  scenario,
  onClose,
}: {
  open: boolean;
  scenario: GetShareOpportunityResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation("shareOpportunity");
  const { theme } = useTheme();
  const { color, text, radius, spacing, layout } = theme;
  const router = useRouter();
  const { customer } = useCustomer();
  const { currentLocation } = useCurrentLocation();
  const { width: windowWidth } = useWindowDimensions();
  const formatBudget = useFormatBudget();
  const { track } = useAnalytics();
  // Centralized creation (request + analytics + story-cache drop + review prompt);
  // this sheet owns only the toast + exit/nav and leaves errors to callAuthed.
  const { submitting, createShare } = useCreateShare();

  // Explicit terms consent for the one-tap create (scenario 3), same gate as the
  // create/confirm screen — the CTA stays disabled until the box is ticked. Reset
  // whenever the sheet closes so consent is a fresh, deliberate act each time.
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);

  // Keep rendering the last real scenario while the sheet animates closed (the
  // detector resets to `none` on dismiss, which would otherwise blank the content).
  const lastShownRef = useRef(scenario);
  if (scenario.scenario !== "none") lastShownRef.current = scenario;
  const shown = lastShownRef.current;

  // Top of the opportunity-sheet funnel — fire once each time the sheet opens with
  // a real opportunity (reset on close so a later re-show re-fires).
  const shownTracked = useRef(false);
  useEffect(() => {
    if (!open) {
      shownTracked.current = false;
      return;
    }
    if (shownTracked.current || shown.scenario === "none") return;
    shownTracked.current = true;
    track("share_opportunity_shown", {
      businessUid: shown.business.uid,
      scenario: shown.scenario,
    });
  }, [open, shown, track]);

  if (shown.scenario === "none") return null;

  const business = shown.business;
  const story = shown.scenario === "inBusinessWithStory" ? shown.story : null;

  const contentWidth = windowWidth - layout.screenPadding * 2;
  const location = currentLocation
    ? { lat: currentLocation.latitude, lon: currentLocation.longitude }
    : null;

  // Scenario 1 — hand off to the full story-picker create flow for this business.
  // Tagged `opportunity_sheet` so the picker funnel stays attributed to the nudge.
  const handleShareIt = () => {
    onClose();
    router.push({
      pathname: "/shares/create",
      params: {
        businessUid: business.uid,
        businessName: business.name,
        source: "opportunity_sheet",
      },
    });
  };

  // Scenario 3 — one-tap create from the already-matched story (passive consent).
  // The hook owns the request + analytics + cache drop + review prompt + error
  // alerts; navigateOnError is false (no picker stack behind the sheet), so a
  // not-tagged / expired-story error just alerts instead of routing.
  const handleCreate = async () => {
    if (submitting || !story || !agreed) return;

    const result = await createShare({
      businessUid: business.uid,
      storyId: story.id,
      source: "opportunity_sheet",
      businessName: business.name,
      navigateOnError: false,
    });
    if (!result.ok) return;

    showToast({ type: "success", text1: t("successToast") });

    const created = result.data?.share;
    onClose(); // close the sheet before navigating away
    if (created) {
      router.push({ pathname: "/shares/[uid]", params: { uid: created.uid } });
    }
  };

  // The matched story is the hero of this scenario — show it at half the content
  // width (a 9:16 preview reads badly at full width), centered.
  const storyWidth = Math.round(contentWidth * 0.5);
  // Reward line — same money treatment as BusinessPreview (green amount, reach),
  // phrased as a plain sentence. `singleCentDigit` matches the card's formatting.
  const rewardLabel =
    business.estimatedRewardCents != null
      ? formatBudget(business.estimatedRewardCents, { singleCentDigit: true })
      : null;
  const reachLabel =
    business.estimatedAverageReach != null
      ? business.estimatedAverageReach.toLocaleString()
      : null;

  return (
    // No `onClose` → the sheet is non-dismissable (no swipe / backdrop / back);
    // the customer decides via a button.
    <BottomSheet open={open}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text
            style={[
              text.title,
              { color: color.text.primary, textAlign: "center" },
            ]}
          >
            {story
              ? t("storyTitle", { business: business.name })
              : t("inBusinessTitle", { business: business.name })}
          </Text>
          <Text
            style={[
              text.body,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            {story ? t("storySubtitle") : t("inBusinessSubtitle")}
          </Text>
        </View>

        {story ? (
          // Scenario 3 — the matched story (the hero), centered, with a plain
          // reward sentence below. No business name (it's already in the title).
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <InstagramStoryPreview
              story={story}
              pfpUrl={customer?.instagram?.pfpUrl ?? null}
              width={storyWidth}
            />
            {/* A connected customer with a matched story always has an estimate,
                so no "calculating" fallback is needed here. */}
            {rewardLabel && (
              <Text
                style={[
                  text.body,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
              >
                <Trans
                  t={t}
                  i18nKey={
                    // Budget-capped → "up to" phrasing (the amount is an upper
                    // bound on a shared budget); uncapped → "around".
                    business.isRewardCapped
                      ? reachLabel
                        ? "rewardSentenceCapped"
                        : "rewardSentenceNoReachCapped"
                      : reachLabel
                        ? "rewardSentence"
                        : "rewardSentenceNoReach"
                  }
                  values={{
                    reward: rewardLabel,
                    reach: reachLabel ?? undefined,
                  }}
                  components={{
                    amount: (
                      <Text
                        style={[text.bodyMedium, { color: color.success }]}
                      />
                    ),
                  }}
                />
              </Text>
            )}
          </View>
        ) : (
          // Scenario 1 — the full business card carries the where + reward
          // context. Inert (disablePress): the sheet is a deliberate decision,
          // so the card must not navigate to the business detail underneath it.
          <BusinessPreview
            business={business}
            width={contentWidth}
            currentLocation={location}
            showEarnButton={false}
            disablePress
          />
        )}

        <View style={{ gap: spacing.sm }}>
          {story ? (
            <>
              {/* Explicit consent, same gate as the create/confirm flow: the box
                  must be ticked before the CTA enables. The whole row toggles
                  (press feedback via the helper); only the nested "terms" run is
                  its own tappable link that opens the doc instead of toggling. */}
              <Pressable
                onPress={() => setAgreed((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                hitSlop={8}
                style={({ pressed, hovered }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
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
                <Text
                  style={[text.caption, { color: color.text.primary, flex: 1 }]}
                >
                  <Trans
                    t={t}
                    i18nKey="agreeLabel"
                    values={{ business: business.name }}
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
                label={t("storyCta", { business: business.name })}
                icon="sparkles"
                disabled={!agreed}
                loading={submitting}
                onPress={handleCreate}
              />
            </>
          ) : (
            <CustomButton
              type="primary"
              label={t("inBusinessCta")}
              icon="sparkles"
              onPress={handleShareIt}
            />
          )}

          {/* Never disabled: the sheet has no backdrop/swipe/back dismissal, so
              this must stay the guaranteed escape even mid-submit (a leaked
              `submitting` flag once made the whole app inescapable — E012).
              Closing mid-flight is fine: a success still toasts + navigates. */}
          <CustomButton
            type="secondary"
            label={t("notNow")}
            onPress={onClose}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
