import { ComponentProps, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  CustomButton,
  PressableText,
  BottomSheet,
  BottomActionBar,
  customAlert,
  StepProgressOverline,
} from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";
import { useInstagramAuthFlow } from "@/hooks/useInstagramAuthFlow";
import { useAnalytics } from "@/utils/analytics";

/**
 * Final onboarding step: link Instagram, then complete registration. Linking
 * requires a (free) Instagram **professional** account — only those expose the
 * post insights Tagly needs to verify a post and calculate a reward — so the
 * screen explains that up front, with a "why?" sheet for detail.
 *
 * "Connect" runs the IG OAuth (`prompt`). On success the code is passed to
 * `finishRegistration` (→ `session.signIn`, flipping the root guard to `(app)`).
 * If a connect attempt doesn't succeed (Instagram's login often stalls when the
 * device browser is already signed in elsewhere), we reveal an **incognito /
 * private-window** retry (`promptEphemeral`), which is the reliable fallback.
 * "Skip for now" completes without Instagram (earning stays gated in-app until a
 * later connection). Consolidates the old connect / page-didn't-load /
 * professional-account screens into one on-brand step.
 */
export default function InstagramScreen() {
  const { t } = useTranslation("instagram");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const insets = useSafeAreaInsets();
  const { finishRegistration, loginWithInstagram, stepProgress } =
    useOnboarding();
  const progress = stepProgress("instagram");
  const { prompt, promptEphemeral } = useInstagramAuthFlow();
  const { track } = useAnalytics();

  const [pending, setPending] = useState<
    "connect" | "incognito" | "skip" | "recover" | null
  >(null);
  // Revealed after a connect attempt fails — surfaces the private-window retry.
  const [failed, setFailed] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  // The pinned BottomActionBar overlays the scroll; reserve its measured height
  // as bottom padding so the centered hero never sits under it. It re-measures
  // when the failed-retry block appears, so the reserve stays correct.
  const [barHeight, setBarHeight] = useState(0);

  const runConnect = async (mode: "normal" | "incognito") => {
    if (pending) return;
    setPending(mode === "normal" ? "connect" : "incognito");
    const result = mode === "normal" ? await prompt() : await promptEphemeral();
    if (result.type !== "success") {
      // cancel / dismiss / error → stay and offer the private-window fallback.
      // Tracked separately: an IG-side error is a platform problem to chase, a
      // cancel/dismiss is user drop-off.
      if (result.type === "error") {
        track("onboarding_instagram_error", {
          instagramError: result.instagramError,
          instagramErrorReason: result.instagramErrorReason,
        });
      } else {
        track("onboarding_instagram_cancelled", { outcome: result.type });
      }
      setPending(null);
      setFailed(true);
      return;
    }
    const outcome = await finishRegistration(result.params.code);
    if (outcome.status === "instagram_taken") {
      // OAuth succeeded but that IG is on another account. Don't take it over —
      // offer logging into the account it belongs to instead.
      setPending(null);
      customAlert(t("takenTitle"), t("takenBody"), [
        { text: t("takenCancel"), style: "cancel", onPress: () => {} },
        { text: t("takenLogin"), onPress: runRecoveryLogin },
      ]);
      return;
    }
    // login → guard flips to (app); error → callPublic alerted, stay here.
    if (outcome.status !== "login") setPending(null);
  };

  // Recovery from a taken IG: re-auth the same account and log into the Tagly
  // account it already belongs to (single-use OAuth codes force a fresh prompt,
  // which `loginWithInstagram` runs).
  const runRecoveryLogin = async () => {
    if (pending) return;
    setPending("recover");
    const outcome = await loginWithInstagram();
    // login → guard flips to (app); cancelled/error → alerted upstream, stay.
    if (outcome.status !== "login") setPending(null);
  };

  const confirmSkip = async () => {
    setPending("skip");
    const outcome = await finishRegistration();
    if (outcome.status !== "login") setPending(null);
  };

  const skip = () => {
    if (pending) return;
    customAlert(t("skipAlertTitle"), t("skipAlertBody"), [
      { text: t("skipAlertCancel"), style: "cancel", onPress: () => {} },
      {
        text: t("skipAlertConfirm"),
        style: "destructive",
        onPress: confirmSkip,
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      {/* Full-height scroll (fills under the notch, like the profile step): the
          hero centers in the whole screen, and the overline floats over the top
          (rendered below) so it never pushes the centering off. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: layout.screenPadding,
          // Own the top inset here (no SafeAreaView) so the scroll fills the
          // screen; clears the notch + the floating overline above.
          paddingTop: insets.top + layout.screenPadding,
          paddingBottom: barHeight + spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            alignItems: "center",
            gap: spacing.xl,
          }}
        >
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: radius.pill,
              backgroundColor: color.brand,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: theme.shadow.card,
            }}
          >
            <Ionicons name="logo-instagram" size={48} color={color.ink} />
          </View>

          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Text
              style={[
                text.title,
                { color: color.text.primary, textAlign: "center" },
              ]}
            >
              {t("heading")}
            </Text>
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("body")}
            </Text>
          </View>

          <PressableText onPress={() => setWhyOpen(true)}>
            {t("why")}
          </PressableText>
        </View>
      </ScrollView>

      {/* Progress floats over the top of the full-height scroll (a small gap
          below the notch) so the hero can center in the whole screen.
          Non-interactive; hidden when it'd be a lone "1 of 1" step. */}
      {progress && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + layout.screenPadding,
            left: layout.screenPadding,
            right: layout.screenPadding,
          }}
        >
          <StepProgressOverline step={progress.step} total={progress.total} />
        </View>
      )}

      {/* Actions in the shared pinned bar (top shadow, owns the bottom safe-area
          inset). The private-window retry appears above them after a failed
          connect — the bar re-measures, so the scroll re-reserves the new height. */}
      <BottomActionBar onHeightChange={setBarHeight} gap={spacing.md}>
        {failed ? (
          <View style={{ gap: spacing.sm }}>
            <Text
              style={[
                text.caption,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("failedNote")}
            </Text>
            <CustomButton
              type="soft"
              label={t("incognito")}
              loading={pending === "incognito"}
              disabled={pending !== null}
              onPress={() => runConnect("incognito")}
              icon="eye-off-outline"
            />
          </View>
        ) : null}

        <CustomButton
          type="primary"
          label={t("connect")}
          loading={pending === "connect"}
          disabled={pending !== null}
          onPress={() => runConnect("normal")}
          icon="logo-instagram"
        />
        <CustomButton
          type="tertiary"
          label={t("skip")}
          disabled={pending !== null}
          onPress={skip}
        />
      </BottomActionBar>

      {/* "Why a professional account?" detail. */}
      <BottomSheet open={whyOpen} onClose={() => setWhyOpen(false)}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("whyHeading")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("whyBody")}
          </Text>
        </View>
        <View style={{ gap: spacing.md }}>
          <Text style={[text.bodyMedium, { color: color.text.primary }]}>
            {t("whyBenefits")}
          </Text>
          <InfoRow
            icon="stats-chart-outline"
            title={t("whyInsightsTitle")}
            body={t("whyInsightsBody")}
          />
          <InfoRow
            icon="cash-outline"
            title={t("whyFreeTitle")}
            body={t("whyFreeBody")}
          />
          <InfoRow
            icon="shield-checkmark-outline"
            title={t("whyPrivacyTitle")}
            body={t("whyPrivacyBody")}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

/** Icon + title + description row used inside the "why?" sheet. */
function InfoRow({
  icon,
  title,
  body,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  return (
    <View
      style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: color.accent,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: theme.shadow.chip,
        }}
      >
        <Ionicons name={icon} size={20} color={color.ink} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {title}
        </Text>
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}
