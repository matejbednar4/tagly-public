import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme, CustomButton } from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";
import { useSession } from "@/contexts/session/SessionContext";

/**
 * Minimum time the "setting up" state stays on screen before the guard flips.
 * `finish-registration` is a single fast call, so without a floor this screen
 * would flash in and out in well under a second. The floor makes it read as a
 * deliberate beat; the real network call runs *in parallel* with the timer, so
 * this adds no latency beyond the wait itself.
 */
const MIN_VISIBLE_MS = 900;

/**
 * Final onboarding step — promotes the pending account to an Advertiser. Unlike
 * every other step this runs **on its own** (no button): it fires
 * `finishRegistration()` on mount and, once both that and a minimum on-screen
 * time have elapsed, signs in — flipping the root guard to `(app)` so this
 * unmounts straight into the home screen. On failure it stops on a retry state
 * (the only interactive affordance) so a transient error doesn't strand the user.
 */
export default function FinishingScreen() {
  const { t } = useTranslation("finishing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const { finishRegistration } = useOnboarding();
  const { signIn } = useSession();

  const [failed, setFailed] = useState(false);
  // Guard against a double-invoke (re-render / fast-refresh) firing two promotes.
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setFailed(false);
    // Promote + a minimum on-screen beat, in parallel — sign in only once both
    // resolve, so the screen never flashes through.
    const [jwt] = await Promise.all([
      finishRegistration(),
      new Promise<void>((resolve) => setTimeout(resolve, MIN_VISIBLE_MS)),
    ]);
    if (jwt) {
      await signIn(jwt); // guard flips → (app); this screen unmounts
      return; // leave `running` set — we're on our way out
    }
    setFailed(true);
    running.current = false;
  }, [finishRegistration, signIn]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <View
        style={{
          flex: 1,
          padding: layout.screenPadding,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xl,
        }}
      >
        {failed ? (
          <>
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: radius.pill,
                backgroundColor: color.surface,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: theme.shadow.card,
              }}
            >
              <Ionicons name="alert-circle" size={48} color={color.danger} />
            </View>
            <View style={{ gap: spacing.sm, alignItems: "center" }}>
              <Text
                style={[
                  text.title,
                  { color: color.text.primary, textAlign: "center" },
                ]}
              >
                {t("errorHeading")}
              </Text>
              <Text
                style={[
                  text.body,
                  { color: color.text.secondary, textAlign: "center" },
                ]}
              >
                {t("errorBody")}
              </Text>
            </View>
            <View style={{ alignSelf: "stretch" }}>
              <CustomButton type="primary" label={t("retry")} onPress={run} />
            </View>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={color.ink} />
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("settingUp")}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
