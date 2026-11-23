import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation, Trans } from "react-i18next";
import { useRouter } from "expo-router";
import {
  useTheme,
  CustomButton,
  CustomTextInput,
  BottomSheet,
  PressableText,
  LocalePicker,
  LOCALE_FLAG,
} from "@tagly/client";
import { openTermsOfService, openPrivacyPolicy } from "@tagly/client";
import { EmailSchema } from "@tagly/models/shared";
import {
  useOnboarding,
  type AuthOutcome,
} from "@/contexts/onboarding/OnboardingContext";
import { useAnalytics } from "@/utils/analytics";

type SignInProps = {
  /** Slide the entry back to the onboarding carousel (entry-owned animation). */
  onShowOnboarding: () => void;
  /** True when sign-in is the visible view of the entry slider — drives autofocus. */
  active?: boolean;
};

/**
 * Sign-in / sign-up entry — the second view of `app/(onboarding)/index.tsx`.
 * Email field + Apple/Google + a forgot-email → Instagram recovery path. Terms/
 * Privacy are accepted **passively** ("by continuing…"); marketing + analytics
 * consent are separate steps after OTP. The region locale is shown as a tappable
 * chip and forced via a bottom sheet if it couldn't be auto-detected — it gates
 * the methods because it drives currency + EU/US consent. All auth logic lives in
 * `useOnboarding()`; this view only renders + routes on the result.
 */
export function SignIn({ onShowOnboarding, active = false }: SignInProps) {
  const { t } = useTranslation("signIn");
  const { t: tLocale } = useTranslation("localePicker");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();

  const {
    locale,
    setLocale,
    startEmail,
    continueWithGoogle,
    continueWithApple,
    loginWithInstagram,
  } = useOnboarding();

  const [email, setEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Which social method is mid-flight (native sheet + backend verify) — drives
  // the in-button spinner and locks the other method until it settles.
  const [pendingMethod, setPendingMethod] = useState<"apple" | "google" | null>(
    null,
  );
  // "Forgot email" → Instagram recovery sheet, and its in-flight flag.
  const [igSheetOpen, setIgSheetOpen] = useState(false);
  const [igPending, setIgPending] = useState(false);
  // Revealed after a login attempt is cancelled/stalls — surfaces the
  // private-window (incognito) retry, the reliable fallback.
  const [igFailed, setIgFailed] = useState(false);

  // Top of the onboarding funnel — fire once, when sign-in first becomes the
  // visible view of the entry slider (it's always mounted, just slid off-screen).
  const { track } = useAnalytics();
  const signinTracked = useRef(false);
  useEffect(() => {
    if (active && !signinTracked.current) {
      signinTracked.current = true;
      track("onboarding_started");
    }
  }, [active, track]);

  const localeReady = !!locale;
  // Validate with the canonical EmailSchema — the exact schema the start-email
  // endpoint enforces server-side, so client + server agree on "valid".
  const emailValid = EmailSchema.safeParse(email).success;
  const emailReady = emailValid && localeReady;
  // Live feedback: error as soon as there's invalid input (empty just leaves
  // Continue disabled, no error).
  const emailError =
    email.trim().length > 0 && !emailValid ? t("invalidEmail") : undefined;

  const submitEmail = async () => {
    if (!emailReady || emailPending) return;
    Keyboard.dismiss();
    setEmailPending(true);
    try {
      const ok = await startEmail(email.trim());
      if (ok) router.push("/otp");
    } finally {
      setEmailPending(false);
    }
  };

  const runSocial = async (
    method: "apple" | "google",
    run: () => Promise<AuthOutcome>,
  ) => {
    if (pendingMethod) return; // ignore taps while one is in-flight
    Keyboard.dismiss();
    setPendingMethod(method);
    try {
      const outcome = await run();
      // login → root guard flips to (app); registration → next onboarding step
      // (route already resolved from fresh facts inside the action).
      if (outcome.status === "registration") {
        router.replace(outcome.next);
      }
    } finally {
      setPendingMethod(null);
    }
  };

  const openForgotEmail = () => {
    Keyboard.dismiss();
    setIgFailed(false); // fresh open — re-arm the retry reveal
    setIgSheetOpen(true);
  };

  const runInstagram = async (mode: "normal" | "incognito") => {
    if (igPending) return;
    setIgPending(true);
    try {
      // success → session.signIn flips the guard to (app); a cancelled/stalled
      // OAuth prompt returns "cancelled" → reveal the private-window retry.
      const outcome = await loginWithInstagram(mode === "incognito");
      if (outcome.status === "cancelled") setIgFailed(true);
    } finally {
      setIgPending(false);
    }
  };

  // Force the picker when this view is active and no locale was detected.
  useEffect(() => {
    if (active && locale === null) setSheetOpen(true);
  }, [active, locale]);

  // No autofocus: this is a "choose a method" screen, and an immediate keyboard
  // would cover the passive-consent line (Terms/Privacy). Just drop the keyboard
  // when the user slides away from sign-in.
  useEffect(() => {
    if (!active) Keyboard.dismiss();
  }, [active]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, padding: layout.screenPadding }}>
          {/* Locale chip (left) + info button (right) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {locale ? (
              <Pressable
                onPress={() => setSheetOpen(true)}
                hitSlop={6}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Text style={[text.label, { color: color.text.secondary }]}>
                  {LOCALE_FLAG[locale]} {tLocale(locale === "US" ? "us" : "cz")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={color.text.tertiary}
                />
              </Pressable>
            ) : (
              <View />
            )}

            <Pressable
              onPress={onShowOnboarding}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("infoA11y")}
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={color.text.tertiary}
              />
            </Pressable>
          </View>

          <View style={{ gap: spacing.xl, marginTop: spacing.md }}>
            <Text style={[text.title, { color: color.text.primary }]}>
              {t("heading")}
            </Text>

            {/* Email */}
            <View style={{ gap: spacing.md }}>
              <CustomTextInput
                placeholder={t("emailPlaceholder")}
                value={email}
                onChangeText={setEmail}
                error={emailError}
                valid={emailValid}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={submitEmail}
              />
              <CustomButton
                type="primary"
                label={t("continue")}
                onPress={submitEmail}
                loading={emailPending}
                disabled={!emailReady}
              />
              {/* Recovery escape hatch, co-located with email entry (the
                  "forgot password" convention) → Instagram login sheet. A
                  whole-label tap, so it's a tertiary (text) button. */}
              <CustomButton
                type="tertiary"
                label={t("forgotEmail")}
                onPress={openForgotEmail}
              />
            </View>

            {/* Separator */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: color.border.divider,
                }}
              />
              <Text style={[text.caption, { color: color.text.tertiary }]}>
                {t("orSeparator")}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: color.border.divider,
                }}
              />
            </View>

            {/* Social + passive consent (covers all methods — tapping = agreeing) */}
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.sm }}>
                {/* Sign in with Apple is an iOS affordance — expo-apple-authentication
                    is unavailable on Android, so the button is hidden there. */}
                {Platform.OS === "ios" && (
                  <CustomButton
                    type="soft"
                    label={t("continueWithApple")}
                    onPress={() => runSocial("apple", continueWithApple)}
                    loading={pendingMethod === "apple"}
                    disabled={!localeReady || pendingMethod !== null}
                    icon="logo-apple"
                  />
                )}
                <CustomButton
                  type="soft"
                  label={t("continueWithGoogle")}
                  onPress={() => runSocial("google", continueWithGoogle)}
                  loading={pendingMethod === "google"}
                  disabled={!localeReady || pendingMethod !== null}
                  icon="logo-google"
                />
              </View>

              {/* Passive consent — Terms / Privacy are tappable in-text links. */}
              <Text
                style={[
                  text.caption,
                  { color: color.text.tertiary, textAlign: "center" },
                ]}
              >
                <Trans
                  t={t}
                  i18nKey="terms"
                  components={{
                    tos: (
                      <PressableText
                        onPress={openTermsOfService}
                        style={text.caption}
                      />
                    ),
                    pp: (
                      <PressableText
                        onPress={openPrivacyPolicy}
                        style={text.caption}
                      />
                    ),
                  }}
                />
              </Text>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>

      <LocalePicker
        open={sheetOpen}
        current={locale ?? null}
        dismissable={!!locale}
        onPick={(l) => {
          setLocale(l);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />

      {/* Forgot-email recovery: log in with the connected Instagram account. */}
      <BottomSheet
        open={igSheetOpen}
        onClose={igPending ? undefined : () => setIgSheetOpen(false)}
      >
        <View style={{ gap: spacing.sm }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            {t("instagramSheetHeading")}
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            {t("instagramSheetBody")}
          </Text>
        </View>
        <CustomButton
          type="primary"
          label={t("loginWithInstagram")}
          onPress={() => runInstagram("normal")}
          loading={igPending}
          icon="logo-instagram"
        />

        {/* After a cancelled/stalled attempt, offer the private-window retry. */}
        {igFailed ? (
          <View style={{ gap: spacing.sm }}>
            <Text
              style={[
                text.caption,
                { color: color.text.secondary, textAlign: "center" },
              ]}
            >
              {t("instagramFailedNote")}
            </Text>
            <CustomButton
              type="soft"
              label={t("loginWithInstagramIncognito")}
              onPress={() => runInstagram("incognito")}
              loading={igPending}
              icon="eye-off-outline"
            />
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
