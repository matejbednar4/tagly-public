import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BottomActionBar,
  callAuthed,
  customAlert,
  CustomButton,
  OtpInput,
  TopMenu,
  useFormatBudget,
  useTheme,
} from "@tagly/client";
import {
  startDeleteAccount,
  confirmDeleteAccount,
} from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useSession } from "@/contexts/session/SessionContext";
import { useOtpSession } from "@/contexts/otp/OtpSessionContext";

const CODE_LENGTH = 6;

/**
 * Delete account — the irreversible, OTP-gated deletion flow, reached from the
 * settings "Danger zone". Twin of the customer delete screen, adapted for the
 * advertiser: there is NO withdraw-first flow, NO Stripe Connect, and NO balance
 * sweep (those are customer-only). Two states:
 *
 *  - **Warning** — the consequences (account/profile deleted, business pages
 *    removed, any remaining credit balance forfeited) + a "Delete my account" CTA
 *    that sends the `ACCOUNT_DELETION` code (`/delete-account/start`) and advances
 *    to verify. The remaining credit balance (available + locked) is shown so the
 *    advertiser sees exactly what they'd forfeit.
 *  - **Verify** — enter the code; `/delete-account/confirm` verifies it and
 *    hard-deletes the account. On success we `signOut()` (clears JWT + cache →
 *    root guard drops to onboarding) and alert the outcome. Resend re-calls
 *    `/start`, gated by the shared OTP cooldown.
 *
 * Domain errors on confirm are handled manually: 1305 (the advertiser still owes
 * money — must be settled with support before the account can be removed) and
 * 1100 (no pending deletion — the start step expired; send a fresh code). OTP
 * errors surface via the central error mapping in `callAuthed`.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation("settingsDelete");
  const { t: ts } = useTranslation("settingsAdvertiser");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const { advertiser } = useAdvertiser();
  const { signOut } = useSession();
  const formatBudget = useFormatBudget();
  const { markOtpSent, reset, secondsUntilResend, canResend } = useOtpSession();

  const [step, setStep] = useState<"warning" | "verify">("warning");
  // The pinned CTA bar overlays the scroll; measure it to reserve room and to
  // lift the focused OTP field clear of the bar (not just the keyboard).
  const [barHeight, setBarHeight] = useState(0);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!advertiser) return null;

  // Everything the advertiser has funded but not yet spent is forfeited on
  // deletion — available credit plus any credit locked against in-flight shares.
  const forfeitCents =
    advertiser.budgets.availableCents + advertiser.budgets.lockedCents;
  const willForfeit = forfeitCents > 0;
  const forfeitLabel = formatBudget(forfeitCents, { forcedCurrency: "USD" });

  const sendCode = async () => {
    if (sending) return;
    setSending(true);
    const res = await callAuthed(router, (jwt) => startDeleteAccount({ jwt }));
    setSending(false);
    if (!res.ok) return;
    markOtpSent();
    setStep("verify");
  };

  const confirm = async () => {
    if (deleting || code.length !== CODE_LENGTH) return;
    setDeleting(true);
    const res = await callAuthed(
      router,
      (jwt) => confirmDeleteAccount({ jwt, body: { otp: code } }),
      { handleSpecificErrorManually: true },
    );

    if (!res.ok) {
      setDeleting(false);
      const domainCode = res.error?.error.code;
      if (domainCode === 1305) {
        // Outstanding balance owed (e.g. an unpaid PAYG period) — must be settled
        // with support before the account can be removed.
        customAlert(t("owesMoneyTitle"), t("owesMoneyBody"));
      } else if (domainCode === 1100) {
        // No pending deletion — the start step expired. Send a fresh code.
        customAlert(t("noPendingTitle"), t("noPendingBody"));
        setStep("warning");
      }
      // Anything else (wrong/expired OTP, network) is alerted centrally; let them
      // retry with a fresh code.
      setCode("");
      return;
    }

    // Account is gone — drop the session and tell them what happened.
    reset();
    await signOut();
    customAlert(
      t("deletedTitle"),
      willForfeit ? t("deletedWithBalanceBody") : t("deletedBody"),
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={ts("deleteTitle")} subheading={ts("title")} showBack />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        // With a lifted CTA bar, lift a focused field clear of the bar (not just
        // the keyboard) by offsetting for the measured bar height.
        bottomOffset={barHeight + spacing.lg}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: barHeight + spacing.lg,
          gap: spacing.xl,
        }}
      >
        {step === "warning" ? (
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
              boxShadow: shadow.card,
              gap: spacing.md,
            }}
          >
            <Text style={[text.heading, { color: color.danger }]}>
              {t("warningHeading")}
            </Text>
            <View style={{ gap: spacing.sm }}>
              <ConsequenceRow
                label={t("warningPoint1")}
                color={color.text.secondary}
                textStyle={text.body}
                gap={spacing.sm}
              />
              <ConsequenceRow
                label={t("warningPoint2")}
                color={color.text.secondary}
                textStyle={text.body}
                gap={spacing.sm}
              />
              <ConsequenceRow
                label={t("warningPoint3")}
                color={color.text.secondary}
                textStyle={text.body}
                gap={spacing.sm}
              />
            </View>
            {willForfeit && (
              <Text style={[text.caption, { color: color.danger }]}>
                {t("warningBalanceNote", { balance: forfeitLabel })}
              </Text>
            )}
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text style={[text.title, { color: color.text.primary }]}>
                {t("verifyHeading")}
              </Text>
              <Text style={[text.body, { color: color.text.secondary }]}>
                {t("verifyBody", { email: advertiser.email })}
              </Text>
            </View>

            <OtpInput value={code} onChangeText={setCode} length={CODE_LENGTH} />

            {/* Resend sits with the code it re-sends, not among the pinned
                delete / keep-account actions. */}
            <CustomButton
              type="tertiary"
              label={
                canResend
                  ? t("resend")
                  : t("resendIn", { seconds: secondsUntilResend })
              }
              loading={sending}
              disabled={!canResend}
              onPress={sendCode}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Pinned actions per state; on verify they lift above the keyboard so the
          delete / keep-account buttons stay reachable while the code is typed. */}
      <BottomActionBar onHeightChange={setBarHeight} keyboardBehavior="lift">
        {step === "warning" ? (
          <CustomButton
            type="destructive"
            label={t("sendCodeButton")}
            loading={sending}
            onPress={sendCode}
          />
        ) : (
          <>
            <CustomButton
              type="destructive"
              label={t("deleteButton")}
              loading={deleting}
              disabled={code.length !== CODE_LENGTH}
              onPress={confirm}
            />
            <CustomButton
              type="secondary"
              label={t("back")}
              disabled={deleting}
              onPress={() => router.back()}
            />
          </>
        )}
      </BottomActionBar>
    </View>
  );
}

/** A single "what deletion does" bullet: a danger dot + line of copy. */
function ConsequenceRow({
  label,
  color,
  textStyle,
  gap,
}: {
  label: string;
  color: string;
  textStyle: object;
  gap: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap }}>
      <Ionicons
        name="close-circle"
        size={18}
        color={color}
        style={{ marginTop: 1 }}
      />
      <Text style={[textStyle, { color, flex: 1 }]}>{label}</Text>
    </View>
  );
}
