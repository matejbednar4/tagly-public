import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  BottomActionBar,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  OtpInput,
  showToast,
  TopMenu,
  useTheme,
} from "@tagly/client";
import {
  startChangeEmail,
  verifyChangeEmail,
} from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import { useOtpSession } from "@/contexts/otp/OtpSessionContext";

const CODE_LENGTH = 6;

/**
 * Change email — the dual-OTP flow (verify the current inbox + the new inbox,
 * then swap). Launched from the Profile screen. Two steps: enter the new email
 * (sends both codes), then enter both codes. Resend re-calls start-change and is
 * gated by the shared OTP cooldown (`useOtpSession` → "Resend in Ns"). OTP errors
 * (wrong/expired code) surface via the central error mapping in `callAuthed`.
 */
export default function ChangeEmailScreen() {
  const { t } = useTranslation("settingsEmail");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const { customer, setCustomer } = useCustomer();
  const { markOtpSent, reset, secondsUntilResend, canResend } = useOtpSession();

  const [step, setStep] = useState<"enterEmail" | "verifyCodes">("enterEmail");
  // The pinned CTA bar overlays the scroll; measure it so content clears it and
  // so the keyboard lifts focused fields above the bar (not just the keyboard).
  const [ctaBarHeight, setCtaBarHeight] = useState(0);
  const [newEmail, setNewEmail] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!customer) return null;

  const sendCodes = async () => {
    if (sending) return;
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      customAlert(t("invalidEmailTitle"), t("invalidEmailBody"));
      return;
    }
    setSending(true);
    const res = await callAuthed(
      router,
      (jwt) => startChangeEmail({ jwt, body: { newEmail: email } }),
      { handleSpecificErrorManually: true },
    );
    setSending(false);
    if (!res.ok) {
      // Only the domain codes (1102/1103) need handling — the central error
      // handler suppresses those (≥1000) but already alerts for everything else
      // (OTP "sent recently", network, rate-limit, …), so don't double-alert.
      const code = res.error?.error.code;
      if (code === 1102) {
        customAlert(t("emailInUseTitle"), t("emailInUseBody"));
      } else if (code === 1103) {
        customAlert(t("sameEmailTitle"), t("sameEmailBody"));
      }
      return;
    }
    markOtpSent();
    setStep("verifyCodes");
  };

  const verify = async () => {
    if (verifying || currentCode.length !== CODE_LENGTH || newCode.length !== CODE_LENGTH) {
      return;
    }
    setVerifying(true);
    const res = await callAuthed(router, (jwt) =>
      verifyChangeEmail({ jwt, body: { currentOtp: currentCode, newOtp: newCode } }),
    );
    setVerifying(false);
    if (!res.ok || !res.data) {
      // The central handler already showed the OTP error; let them retry.
      setCurrentCode("");
      setNewCode("");
      return;
    }
    setCustomer((prev) => (prev ? { ...prev, email: res.data!.newEmail } : prev));
    reset();
    showToast({
      type: "success",
      text1: t("successTitle"),
      text2: t("successBody"),
    });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={t("title")} subheading={ts("title")} showBack />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        // Lift the focused field clear of the pinned CTA bar (which itself rides
        // above the keyboard), not just the keyboard — so offset by the measured
        // bar height + a gap.
        bottomOffset={ctaBarHeight + spacing.lg}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: ctaBarHeight + spacing.lg,
          gap: spacing.xl,
        }}
      >
        {step === "enterEmail" ? (
          <View style={{ gap: spacing.lg }}>
            <CustomTextInput
              heading={t("newEmailLabel")}
              placeholder={t("newEmailPlaceholder")}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={sendCodes}
            />
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {t("step1Description")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={[text.title, { color: color.text.primary }]}>
                {t("step2Heading")}
              </Text>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("step2Description")}
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("codeSentTo", { email: customer.email })}
              </Text>
              <OtpInput
                value={currentCode}
                onChangeText={setCurrentCode}
                length={CODE_LENGTH}
              />
            </View>

            <View style={{ gap: spacing.md }}>
              <Text style={[text.label, { color: color.text.secondary }]}>
                {t("codeSentTo", { email: newEmail.trim().toLowerCase() })}
              </Text>
              <OtpInput
                value={newCode}
                onChangeText={setNewCode}
                length={CODE_LENGTH}
              />
            </View>

            {/* Resend sits with the codes it re-sends, not among the pinned
                confirm/cancel actions. */}
            <CustomButton
              type="tertiary"
              label={
                canResend
                  ? t("resend")
                  : t("resendIn", { seconds: secondsUntilResend })
              }
              loading={sending}
              disabled={!canResend}
              onPress={sendCodes}
            />
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Pinned actions — lift above the keyboard so the CTA stays reachable
          while the codes/email are being typed. */}
      <BottomActionBar onHeightChange={setCtaBarHeight} keyboardBehavior="lift">
        {step === "enterEmail" ? (
          <CustomButton
            type="primary"
            label={t("sendCodes")}
            loading={sending}
            disabled={!newEmail.trim()}
            onPress={sendCodes}
          />
        ) : (
          <>
            <CustomButton
              type="primary"
              label={t("verify")}
              loading={verifying}
              disabled={
                currentCode.length !== CODE_LENGTH ||
                newCode.length !== CODE_LENGTH
              }
              onPress={verify}
            />
            <CustomButton
              type="secondary"
              label={t("cancel")}
              disabled={verifying}
              onPress={() => router.back()}
            />
          </>
        )}
      </BottomActionBar>
    </View>
  );
}
