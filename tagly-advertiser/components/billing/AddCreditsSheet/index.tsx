import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  useTheme,
  BottomSheet,
  CustomButton,
  CustomTextInput,
  callAuthed,
  customAlert,
  formatBudget,
  pressFeedbackStyle,
} from "@tagly/client";
import { CREDIT_PURCHASES } from "@tagly/models/shared";
import { createCreditPurchase } from "@tagly/sdk/v2/advertiserApp";
import {
  PaymentPhaseView,
  type PaymentVerifyPhase,
} from "@/components/billing/PaymentPhaseView";
import { MethodHeader } from "@/components/billing/shared/MethodHeader";
import { useCreditPurchase } from "@/components/billing/shared/useCreditPurchase";
import { useConfirmedExit } from "@/components/billing/shared/useConfirmedExit";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/** Preset amounts (USD cents) for the one-time purchase. */
const PRESETS_CENTS = [100_00, 250_00, 500_00];
const DEFAULT_PRESET_CENTS = 250_00;

/**
 * Add credits — a pure transaction, in every account state. It never mentions,
 * offers or mutates a recurring rule.
 *
 * That separation is the rule, not a simplification (Matej, 2026-09-03):
 * **buying credits and the monthly top-up are completely separate features.**
 * Entangling them is what produced the original bug — one sheet owned both
 * buying and the monthly setting, so an active top-up took the sheet over and
 * "Add credits" landed the advertiser in a settings screen. The monthly rule
 * lives only in `MonthlyTopUpSheet`, which shows the card-link sheet rather
 * than a purchase.
 *
 * Flow: pick an amount → `POST /billing/credit-purchases` → Stripe
 * PaymentSheet → **verify**: the sheet flips into a non-dismissable verifying
 * state and polls the purchase row until the webhook books the credits →
 * success beat → `onPurchased(amountCents)`. A cancel returns here with the
 * amount intact; an exhausted poll budget lands in a closable "we couldn't
 * verify" state rather than claiming either outcome.
 *
 * Containment: the sheet is non-dismissable while busy / verifying / on the
 * success beat, so the whole flow runs inside a try/catch that restores the
 * dismissable form on an unexpected throw (see the busy-flag rule in
 * `tagly-shared/client/CLAUDE.md`).
 */
export function AddCreditsSheet({
  open,
  onClose,
  onClosed,
  onPurchased,
  surface,
}: {
  open: boolean;
  onClose: () => void;
  /** Forwarded to BottomSheet so the host can chain sheets safely
   *  (`useSheetRouter`) — two Modals must never be mounted at once. */
  onClosed?: () => void;
  /** The purchase was booked (webhook-verified) — the account is funded. */
  onPurchased: (amountCents: number) => void;
  /** Which host mounted the sheet — stamped on `credits_purchased`. */
  surface: BillingSurface;
}) {
  const { t } = useTranslation("addCreditsSheet");
  const { theme } = useTheme();
  const { color, text, spacing, radius, shadow } = theme;
  const router = useRouter();
  const { track } = useAnalytics();
  const { runPayment } = useCreditPurchase();
  const { afterBeat } = useConfirmedExit();

  const [amount, setAmount] = useState(String(DEFAULT_PRESET_CENTS / 100));
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<PaymentVerifyPhase | null>(null);
  const [phaseCopy, setPhaseCopy] = useState<{ title: string; body: string }>({
    title: "",
    body: "",
  });

  // Fresh form on every open (a previous run may have ended unverified).
  useEffect(() => {
    if (open) {
      setPhase(null);
      setBusy(false);
    }
  }, [open]);

  const showPhase = (
    next: PaymentVerifyPhase,
    copy: { title: string; body: string },
  ) => {
    setPhaseCopy(copy);
    setPhase(next);
  };
  const restoreForm = () => {
    setPhase(null);
    setBusy(false);
  };

  const amountCents = amount ? Number(amount) * 100 : 0;
  const belowMin = amountCents < CREDIT_PURCHASES.MIN_AMOUNT_CENTS;
  const aboveMax = amountCents > CREDIT_PURCHASES.MAX_AMOUNT_CENTS;
  const valid = !belowMin && !aboveMax;
  const amountLabel = formatBudget(amountCents, { showCents: false });

  const pay = async () => {
    if (busy || !valid) return;
    setBusy(true);
    try {
      const purchase = await callAuthed(router, (jwt) =>
        createCreditPurchase({ jwt, body: { amountCents } }),
      );
      if (!purchase.ok || !purchase.data) {
        setBusy(false);
        return;
      }
      // The shared payment flow: PaymentSheet, then poll the purchase row —
      // the sheet saying yes is never authoritative.
      const { outcome, message } = await runPayment({
        intent: purchase.data,
        onVerifying: () =>
          showPhase("verifying", {
            title: t("verifyingTitle"),
            body: t("verifyingBody"),
          }),
      });

      if (outcome === "completed") {
        track("credits_purchased", { amountCents, surface });
        showPhase("success", {
          title: t("successTitle", { amount: amountLabel }),
          body: t("successBody"),
        });
        afterBeat(() => onPurchased(amountCents));
      } else if (outcome === "failed") {
        customAlert(t("alertTitle"), t("failedBody"));
        restoreForm();
      } else if (outcome === "unverified") {
        // Poll budget exhausted with the row still PENDING — don't claim
        // success, don't scare with failure. The webhook may still land.
        showPhase("unverified", {
          title: t("unverifiedTitle"),
          body: t("unverifiedBody"),
        });
        setBusy(false);
      } else {
        // `cancelled` is silent — back to the form with the amount intact.
        if (outcome === "error") {
          customAlert(t("alertTitle"), message ?? t("alertBody"));
        }
        setBusy(false);
      }
    } catch {
      restoreForm();
      customAlert(t("alertTitle"), t("alertBody"));
    }
  };

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
          title={phaseCopy.title}
          body={phaseCopy.body}
          ctaLabel={t("unverifiedCta")}
          onCtaPress={onClose}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <MethodHeader method="credits" />

          {/* The question owns the whole amount block — presets first, the
              typed field as its escape hatch — so it sits above the chips and
              outranks the field's own label. */}
          <View style={{ gap: spacing.sm }}>
            <Text style={[text.bodyMedium, { color: color.text.primary }]}>
              {t("amountQuestion")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {PRESETS_CENTS.map((cents) => {
                const selected = amountCents === cents;
                return (
                  <Pressable
                    key={cents}
                    onPress={() => setAmount(String(cents / 100))}
                    style={({
                      pressed,
                      hovered,
                    }: {
                      pressed: boolean;
                      hovered?: boolean;
                    }) => [
                      {
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.pill,
                        backgroundColor: selected ? color.ink : color.surface,
                        boxShadow: shadow.chip,
                      },
                      pressFeedbackStyle({ pressed, hovered }),
                    ]}
                  >
                    <Text
                      style={[
                        text.label,
                        { color: selected ? color.on.ink : color.text.primary },
                      ]}
                    >
                      {formatBudget(cents, { showCents: false })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* A label, not a placeholder: the field is never empty (a preset is
              selected on open), so placeholder copy would never be seen. It
              stays a quiet `subheading` — the question above owns the block;
              this only names the typed alternative to the chips. */}
          <CustomTextInput
            subheading={t("customLabel")}
            prefix="$"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
            // No `returnKeyType` on a keypad: it has no return key, so iOS
            // floats a "Done" pill over the sheet to host one. Every other
            // keypad field in the apps omits it for the same reason.
            keyboardType="number-pad"
            error={
              amount && belowMin
                ? t("minNote", {
                    min: formatBudget(CREDIT_PURCHASES.MIN_AMOUNT_CENTS, {
                      showCents: false,
                    }),
                  })
                : aboveMax
                  ? t("maxNote")
                  : undefined
            }
          />

          <CustomButton
            type="primary"
            label={valid ? t("cta", { amount: amountLabel }) : t("ctaInvalid")}
            onPress={() => void pay()}
            loading={busy}
            disabled={!valid}
          />
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
