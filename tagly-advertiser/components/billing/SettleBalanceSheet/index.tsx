import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  useTheme,
  BottomSheet,
  CustomButton,
  callAuthed,
  customAlert,
  formatBudget,
} from "@tagly/client";
import { settleNegativeBalance } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import {
  PaymentPhaseView,
  type PaymentVerifyPhase,
} from "@/components/billing/PaymentPhaseView";
import { useCreditPurchase } from "@/components/billing/shared/useCreditPurchase";
import { useConfirmedExit } from "@/components/billing/shared/useConfirmedExit";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/**
 * Settle-balance bottom sheet — pay off a negative available balance (an
 * uncollectable PAYG debt that made the account invisible). It's a credit
 * purchase with a server-computed amount (the debt), so it reuses the exact
 * PaymentSheet + verify machinery as `AddCreditsSheet`, minus the amount picker:
 *
 * Pay → `POST /v2/.../billing/settle-balance` (no body; server returns the
 * charged `amountCents` + PaymentIntent) → PaymentSheet → **verify**: flips into
 * a non-dismissable verifying state and polls the purchase status until the
 * webhook books the credit (COMPLETED). Confirmed → in-sheet success beat →
 * `onSettled()`. FAILED → alert, back to the form. Poll exhausted → a closable
 * "we couldn't verify" state (the webhook may still land; balance re-derives).
 * Paying the debt brings available back to zero and the account visible again.
 *
 * The owed figure shown before paying comes from the balance on `AdvertiserMe`
 * (context); the amount actually charged comes back from the server and drives
 * the success copy (they only differ in the vanishingly-rare sub-$0.50 debt,
 * floored to Stripe's minimum, where the remainder lands as credit).
 */
export function SettleBalanceSheet({
  open,
  onClose,
  onClosed,
  onSettled,
  surface,
}: {
  open: boolean;
  onClose: () => void;
  /** Forwarded to BottomSheet so the host knows when the surface is empty
   *  (`useSheetRouter`) — two Modals must never be mounted at once. */
  onClosed?: () => void;
  onSettled: () => void;
  /** Which host mounted the sheet — stamped on the `balance_settled` event. */
  surface: BillingSurface;
}) {
  const { t } = useTranslation("settleBalanceSheet");
  const { theme } = useTheme();
  const { color, text, spacing, radius } = theme;
  const router = useRouter();
  const { advertiser } = useAdvertiser();
  const { track } = useAnalytics();
  const { runPayment } = useCreditPurchase();
  const { afterBeat, now } = useConfirmedExit();

  const [busy, setBusy] = useState(false);
  // null = the confirm form; otherwise the post-payment verification phase.
  const [phase, setPhase] = useState<PaymentVerifyPhase | null>(null);
  // The amount the server actually charged (drives the success copy).
  const [chargedCents, setChargedCents] = useState(0);

  // Fresh form every time the sheet reopens (a previous run may have ended in
  // the unverified state).
  useEffect(() => {
    if (open) {
      setPhase(null);
      setBusy(false);
    }
  }, [open]);

  const availableCents = advertiser?.budgets?.availableCents ?? 0;
  const owedCents = availableCents < 0 ? -availableCents : 0;
  const owedLabel = formatBudget(owedCents, { showCents: true });

  const pay = async () => {
    if (busy || owedCents <= 0) return;
    setBusy(true);
    try {
      const res = await callAuthed(
        router,
        (jwt) => settleNegativeBalance({ jwt }),
        { handleSpecificErrorManually: true },
      );
      if (!res.ok || !res.data) {
        const code = !res.ok ? res.error?.error.code : undefined;
        setBusy(false);
        if (code === 1318) {
          // Nothing owed anymore (settled on another device, or the webhook
          // landed) — the cached balance is stale. Refresh /me and resolve like
          // a settle, so the pay-balance CTA disappears.
          customAlert(t("alreadySettledTitle"), t("alreadySettledBody"));
          void now(onSettled);
        } else if (typeof code === "number" && code >= 1000) {
          customAlert(t("alertTitle"), t("alertBody"));
        }
        return;
      }
      const { amountCents } = res.data;
      setChargedCents(amountCents);

      // The same shared payment flow as a normal top-up — the only difference
      // is who chose the amount.
      const { outcome, message } = await runPayment({
        intent: res.data,
        onVerifying: () => setPhase("verifying"),
      });

      if (outcome === "completed") {
        track("balance_settled", { amountCents, surface });
        setPhase("success");
        afterBeat(onSettled);
      } else if (outcome === "failed") {
        customAlert(t("alertTitle"), t("failedBody"));
        setPhase(null);
        setBusy(false);
      } else if (outcome === "unverified") {
        // Poll budget exhausted with the row still PENDING — don't claim success,
        // don't scare with failure. The webhook may still land.
        setPhase("unverified");
        setBusy(false);
      } else {
        // `cancelled` is silent — back to this sheet.
        if (outcome === "error") {
          customAlert(t("alertTitle"), message ?? t("alertBody"));
        }
        setBusy(false);
      }
    } catch {
      // Nothing above is expected to throw (callAuthed and the Stripe module
      // resolve with error shapes), but the sheet is non-dismissable while
      // `busy`/`verifying`, and its reset-on-open effect can only run if the
      // sheet can close — so an unexpected rejection would wedge it with no
      // exit. Restore the dismissable form instead.
      setPhase(null);
      setBusy(false);
      customAlert(t("alertTitle"), t("alertBody"));
    }
  };

  const chargedLabel = formatBudget(chargedCents, { showCents: true });

  // While verifying or celebrating the sheet must not be dismissable; the
  // unverified state closes only through its CTA (or the backdrop).
  const closable = phase === "unverified" || (phase === null && !busy);

  return (
    <BottomSheet
      open={open}
      onClose={closable ? onClose : undefined}
      onClosed={onClosed}
    >
      {phase !== null ? (
        <PaymentPhaseView
          phase={phase}
          title={
            phase === "verifying"
              ? t("verifyingTitle")
              : phase === "success"
                ? t("successTitle")
                : t("unverifiedTitle")
          }
          body={
            phase === "verifying"
              ? t("verifyingBody")
              : phase === "success"
                ? t("successBody", { amount: chargedLabel })
                : t("unverifiedBody")
          }
          ctaLabel={t("unverifiedCta")}
          onCtaPress={onClose}
        />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[text.title, { color: color.text.primary }]}>
              {t("title")}
            </Text>
            <Text style={[text.body, { color: color.text.secondary }]}>
              {t("intro")}
            </Text>
          </View>

          {/* The debt — a danger-tinted callout with the amount owed. */}
          <View
            style={{
              backgroundColor: color.dangerBg,
              borderRadius: radius.structure,
              padding: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={color.on.dangerBg}
              />
              <Text
                style={[
                  text.label,
                  {
                    color: color.on.dangerBg,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  },
                ]}
              >
                {t("owedHeading")}
              </Text>
            </View>
            <Text style={[text.amountLg, { color: color.on.dangerBg }]}>
              {owedLabel}
            </Text>
          </View>

          <CustomButton
            type="primary"
            label={t("cta", { amount: owedLabel })}
            onPress={() => void pay()}
            loading={busy}
            disabled={owedCents <= 0}
          />
          {/* The owed figure is the cached balance; the true charge is confirmed
              in the payment sheet (it can differ if the balance moved since). */}
          <Text
            style={[
              text.caption,
              { color: color.text.secondary, textAlign: "center" },
            ]}
          >
            {t("amountNote")}
          </Text>
          <Text
            style={[
              text.micro,
              { color: color.text.tertiary, textAlign: "center" },
            ]}
          >
            {t("footnote")}
          </Text>
        </View>
      )}
    </BottomSheet>
  );
}
