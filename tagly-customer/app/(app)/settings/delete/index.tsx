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
} from "@tagly/sdk/v2/customerApp";
import { useCustomer } from "@/contexts/Customer";
import { useSession } from "@/contexts/session/SessionContext";
import { useOtpSession } from "@/contexts/otp/OtpSessionContext";

const CODE_LENGTH = 6;

/**
 * Delete account — the irreversible, OTP-gated deletion flow, reached from the
 * settings "Danger zone". Three states:
 *
 *  - **Withdraw first** — a positive balance with payouts NOT enabled can't be
 *    swept, so the wall offers a choice: withdraw first (primary, today's path)
 *    or delete anyway and forfeit the balance (destructive) — deletion must
 *    never require Stripe Connect onboarding (App Review 5.1.1(v)). Choosing
 *    forfeit continues into the normal warning → verify flow, with the forfeit
 *    consequence restated on the warning screen, and sends
 *    `forfeitConsent: true` on confirm.
 *  - **Warning** — the consequences + a "Delete my account" CTA that sends the
 *    `ACCOUNT_DELETION` code (`/delete-account/start`) and advances to verify.
 *  - **Verify** — enter the code; `/delete-account/confirm` verifies it, sweeps
 *    any remaining balance to the bank (or forfeits it, when consented), and
 *    hard-deletes the account. On success we `signOut()` (clears JWT + cache →
 *    root guard drops to onboarding) and alert the outcome. Resend re-calls
 *    `/start`, gated by the shared OTP cooldown.
 *
 * Domain errors on confirm are handled manually (the manual flag mutes ALL
 * codes >= 1000 centrally, so every one needs a branch): 1200 (a withdrawal is
 * already in flight) and 1202 (the balance sweep is still settling) ask the
 * user to retry shortly; 1201 (withdraw first) alerts and routes to /withdraw —
 * the withdraw-first pre-empt reads the CACHED /me, so a balance that settled
 * since then still lands here (unless forfeit was consented, which skips 1201
 * server-side); 1100 (OTP session expired/cleaned up) points at the resend
 * button; anything else gets a generic failure alert. Plain OTP errors (< 1000)
 * surface via the central error mapping in `callAuthed`.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation("settingsDelete");
  const { t: ts } = useTranslation("settings");
  const router = useRouter();
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const { customer } = useCustomer();
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
  // The user explicitly chose "delete anyway and forfeit" on the withdraw-first
  // wall — unlocks the normal warning → verify flow and rides to the backend as
  // `forfeitConsent: true` on confirm. Leaving the screen resets it (unmount).
  const [forfeitChosen, setForfeitChosen] = useState(false);

  if (!customer) return null;

  const balanceCents = customer.sensitiveData.balanceUsdCents;
  const payoutsEnabled = customer.sensitiveData.payoutsEnabledAt !== null;
  // A positive balance with no way to pay it out: withdraw first, or forfeit.
  const mustWithdrawFirst = balanceCents > 0 && !payoutsEnabled;
  const showWithdrawWall = mustWithdrawFirst && !forfeitChosen;
  const willSweepBalance = balanceCents > 0 && payoutsEnabled;
  const willForfeitBalance = mustWithdrawFirst && forfeitChosen;
  const balanceLabel = formatBudget(balanceCents, { forcedCurrency: "USD" });

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
      (jwt) =>
        confirmDeleteAccount({
          jwt,
          // Only send the consent flag when the forfeit path was explicitly
          // chosen — the plain and sweep paths stay byte-identical to before.
          body: willForfeitBalance
            ? { otp: code, forfeitConsent: true }
            : { otp: code },
        }),
      { handleSpecificErrorManually: true },
    );

    if (!res.ok) {
      setDeleting(false);
      const domainCode = res.error?.error.code;
      // `handleSpecificErrorManually` mutes EVERY domain code (>= 1000) in the
      // central handler, so each one the endpoint can throw needs a branch here
      // — an unmapped code must never fail silently (E043).
      // 1200: a withdrawal is already locked. 1202: the deletion sweep is still
      // settling. Both are transient — ask the user to try again shortly.
      if (domainCode === 1200) {
        customAlert(t("fundsLockedTitle"), t("fundsLockedBody"));
      } else if (domainCode === 1202) {
        customAlert(t("sweepInFlightTitle"), t("sweepInFlightBody"));
      } else if (domainCode === 1201) {
        // A balance arrived (a share settled) or payouts got revoked since the
        // cached /me that drives the withdraw-first pre-empt — route to cash out.
        customAlert(t("mustWithdrawTitle"), t("mustWithdrawBody"), [
          { text: t("back"), style: "cancel", onPress: () => {} },
          {
            text: t("withdrawFirstButton"),
            onPress: () => router.push("/withdraw"),
          },
        ]);
      } else if (domainCode === 1100) {
        // The OTP session expired / was cleaned up between start and confirm —
        // routine after ~30 min or a verify lockout, not an edge case.
        customAlert(t("codeExpiredTitle"), t("codeExpiredBody"));
      } else if (typeof domainCode === "number" && domainCode >= 1000) {
        // Fallback so no current or future domain code is ever silent. Codes
        // < 1000 (wrong/expired OTP, network) are alerted centrally.
        customAlert(t("deleteFailedTitle"), t("deleteFailedBody"));
      }
      setCode("");
      return;
    }

    // Account is gone — drop the session and tell them what happened.
    reset();
    await signOut();
    customAlert(
      t("deletedTitle"),
      willSweepBalance ? t("deletedWithBalanceBody") : t("deletedBody"),
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
        {showWithdrawWall ? (
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
              boxShadow: shadow.card,
              gap: spacing.md,
            }}
          >
            <Text style={[text.heading, { color: color.text.primary }]}>
              {t("withdrawFirstHeading")}
            </Text>
            <Text style={[text.body, { color: color.text.secondary }]}>
              {t("withdrawFirstBody", { balance: balanceLabel })}
            </Text>
          </View>
        ) : step === "warning" ? (
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
            {willSweepBalance && (
              <Text style={[text.caption, { color: color.success }]}>
                {t("warningBalanceNote", { balance: balanceLabel })}
              </Text>
            )}
            {willForfeitBalance && (
              <Text style={[text.caption, { color: color.danger }]}>
                {t("warningForfeitNote", { balance: balanceLabel })}
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
                {t("verifyBody", { email: customer.email })}
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
        {showWithdrawWall ? (
          <>
            <CustomButton
              type="primary"
              label={t("withdrawFirstButton")}
              icon="cash-outline"
              onPress={() => router.push("/withdraw")}
            />
            {/* The Apple 5.1.1(v) escape hatch: deletion must not require
                completing a withdrawal (Stripe Connect onboarding). Advances to
                the normal warning → verify flow with the forfeit consented. */}
            <CustomButton
              type="destructive"
              label={t("forfeitButton", { balance: balanceLabel })}
              onPress={() => setForfeitChosen(true)}
            />
          </>
        ) : step === "warning" ? (
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
