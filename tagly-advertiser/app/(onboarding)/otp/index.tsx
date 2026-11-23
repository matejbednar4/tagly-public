import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter, useNavigation } from "expo-router";
import {
  useTheme,
  CustomButton,
  OtpInput,
  type OtpInputHandle,
} from "@tagly/client";
import { useOnboarding } from "@/contexts/onboarding/OnboardingContext";
import { useOtpSession } from "@/contexts/otp/OtpSessionContext";

const CODE_LENGTH = 6;

/**
 * Email OTP step: enter the code sent to the entered email. Verify/resend run
 * through `useOnboarding()`; the resend cooldown is read from the app-wide
 * `useOtpSession()`. On a registration result we advance to the next step; on
 * login the root guard flips to `(app)` and this screen unmounts.
 */
export default function OtpScreen() {
  const { t } = useTranslation("otp");
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const navigation = useNavigation();

  const { email, verifyOtp, resendOtp } = useOnboarding();
  const { secondsUntilResend, canResend } = useOtpSession();

  const otpRef = useRef<OtpInputHandle>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Raise the keyboard only after the screen has finished sliding in. The native
  // stack emits `transitionEnd` (closing=false on enter); InteractionManager
  // can't be used here because native-stack animations run off the JS thread.
  // (expo-router's generic navigation type omits this event — cast to its shape.)
  useEffect(() => {
    const nav = navigation as unknown as {
      addListener: (
        type: "transitionEnd",
        cb: (e: { data?: { closing?: boolean } }) => void,
      ) => () => void;
    };
    const unsubscribe = nav.addListener("transitionEnd", (e) => {
      if (!e.data?.closing) otpRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  const submit = async (value: string = code) => {
    if (value.length !== CODE_LENGTH || verifying) return;
    Keyboard.dismiss();
    setVerifying(true);
    try {
      const outcome = await verifyOtp(value);
      // login → guard flips to (app); registration → next onboarding step
      // (route already resolved from fresh resume facts inside verifyOtp).
      if (outcome.status === "registration") {
        router.replace(outcome.next);
      }
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    try {
      await resendOtp();
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, padding: layout.screenPadding }}>
          {/* Back → sign-in */}
          <View style={{ flexDirection: "row", justifyContent: "flex-start" }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("backA11y")}
            >
              <Ionicons name="arrow-back" size={26} color={color.text.primary} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.xl, marginTop: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={[text.title, { color: color.text.primary }]}>
                {t("heading")}
              </Text>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("sentTo", { email })}
              </Text>
            </View>

            {/* Standalone so the cells get balanced breathing room (xl above
                from the heading, xl below to the action block). */}
            <OtpInput
              ref={otpRef}
              value={code}
              onChangeText={setCode}
              length={CODE_LENGTH}
              onComplete={submit}
            />

            {/* Verify + resend as one action block. */}
            <View style={{ gap: spacing.md }}>
              <CustomButton
                type="primary"
                label={t("verify")}
                onPress={() => submit()}
                loading={verifying}
                disabled={code.length !== CODE_LENGTH}
              />
              {/* Whole-label tap → a tertiary (text) button, not PressableText. */}
              <CustomButton
                type="tertiary"
                label={
                  canResend
                    ? t("resend")
                    : t("resendIn", { seconds: secondsUntilResend })
                }
                onPress={onResend}
                loading={resending}
                disabled={!canResend}
              />
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
