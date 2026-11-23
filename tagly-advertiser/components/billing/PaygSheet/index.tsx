import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTheme,
  BottomSheet,
  CustomButton,
  callAuthed,
  customAlert,
  formatBudget,
} from "@tagly/client";
import { isEULocale, PAYG } from "@tagly/models/shared";
import type { GetPaygStateResponse } from "@tagly/models/v2/advertiserApp";
import { enablePayg, disablePayg } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import {
  PaymentPhaseView,
  type PaymentVerifyPhase,
} from "@/components/billing/PaymentPhaseView";
import { MethodHeader } from "@/components/billing/shared/MethodHeader";
import { MethodBenefits } from "@/components/billing/shared/MethodBenefits";
import { StatusPill } from "@/components/billing/shared/StatusPill";
import { ConsentCheckbox } from "@/components/billing/shared/ConsentCheckbox";
import { useCardLink } from "@/components/billing/shared/useCardLink";
import { useFundingState } from "@/components/billing/shared/useFundingState";
import { PAYG_STATE_QUERY_KEY } from "@/components/billing/shared/usePaygState";
import { useConfirmedExit } from "@/components/billing/shared/useConfirmedExit";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/**
 * Pay as you go — the rule, and nothing else. Card management moved out to
 * `CardSheet` in the 2026-09-02 restructure: this sheet turns the rule on and
 * off, and hands anything about the card itself to the sheet that owns it, so
 * "turn off pay as you go" no longer has to stop and ask what should happen to
 * a card the monthly top-up might also be using.
 *
 * States:
 * - **No card** — the pitch, the charge consent (EU checkbox / US disclosure),
 *   and a CTA that links a card via the shared `useCardLink` and then turns
 *   PAYG on. This is the only flow here that touches Stripe.
 * - **Card on file, off** — the consent line plus "Turn on" (`POST /payg`, no
 *   PaymentSheet).
 * - **On** — the active state and "Turn off" (`DELETE /payg`; the card stays,
 *   because it is the account's card, not this feature's).
 * - **Card issue** — the last charge declined; the action is to update the
 *   card, which opens the Card sheet.
 *
 * PAYG has no spend cap, and credits are always spent before it — both stated
 * in the pitch, so the two rules read as ordered rather than as rivals.
 */
export function PaygSheet({
  open,
  onClose,
  onClosed,
  onLinked,
  onChanged,
  onOpenCard,
  surface,
}: {
  open: boolean;
  onClose: () => void;
  /** Forwarded to BottomSheet so the host can chain sheets safely
   *  (`useSheetRouter`) — two Modals must never be mounted at once. */
  onClosed?: () => void;
  /** Turned on (with a fresh card or an existing one) — the account is funded. */
  onLinked: () => void;
  /** Turned off (no new funding). */
  onChanged?: () => void;
  /** Hands card management to the Card sheet. */
  onOpenCard: () => void;
  surface: BillingSurface;
}) {
  const { t } = useTranslation("paygSheet");
  const { t: tb } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const router = useRouter();
  const qc = useQueryClient();
  const { advertiser } = useAdvertiser();
  const { track } = useAnalytics();
  const { linkCard } = useCardLink();
  const { afterBeat, now } = useConfirmedExit();

  const needsCheckbox = !advertiser || isEULocale(advertiser.locale);
  const funding = useFundingState({ enabled: open });
  const { payg, hasCard } = funding;

  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<PaymentVerifyPhase | null>(null);
  const [successKind, setSuccessKind] = useState<"linked" | "turnedOn">(
    "linked",
  );
  useEffect(() => {
    if (open) {
      setPhase(null);
      setBusy(false);
      setConsented(false);
      setSuccessKind("linked");
    }
  }, [open]);
  const surcharge = formatBudget(PAYG.SURCHARGE_CENTS);
  const chargeFailed = payg.status === "CARD_FAILED";
  const paygOff = hasCard && !payg.active && !chargeFailed;

  /** Link a card, then turn PAYG on. */
  const linkAndTurnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await linkCard({
        onVerifying: () => setPhase("verifying"),
      });
      if (outcome === "cancelled") {
        setPhase(null);
        setBusy(false);
        return;
      }
      if (outcome === "failed") {
        setPhase(null);
        setBusy(false);
        customAlert(t("alertTitle"), t("alertBody"));
        return;
      }
      if (outcome === "unverified") {
        setPhase("unverified");
        setBusy(false);
        return;
      }

      // Card confirmed. Turn PAYG on unless it already is (replacing a card
      // while active must not close and reopen the period).
      if (!payg.active) {
        const on = await callAuthed(router, (jwt) =>
          enablePayg({ jwt, body: { chargeAuthorized: true } }),
        );
        if (!on.ok || !on.data) {
          // The card IS linked; only the turn-on failed. Back to the form,
          // which now offers "Turn on" for a retry.
          setPhase(null);
          setBusy(false);
          customAlert(t("turnOnFailedTitle"), t("turnOnFailedBody"));
          return;
        }
        void qc.invalidateQueries({ queryKey: PAYG_STATE_QUERY_KEY });
      }
      track("payg_card_linked", { surface, action: "link" });
      setSuccessKind("linked");
      setPhase("success");
      afterBeat(onLinked);
    } catch {
      setPhase(null);
      setBusy(false);
      customAlert(t("alertTitle"), t("alertBody"));
    }
  };

  /** Turn on with the card already on file (no PaymentSheet). */
  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callAuthed(router, (jwt) =>
        enablePayg({ jwt, body: { chargeAuthorized: true } }),
      );
      if (!res.ok || !res.data) {
        setBusy(false);
        return;
      }
      track("payg_turned_on", { surface });
      void qc.invalidateQueries({ queryKey: PAYG_STATE_QUERY_KEY });
      setSuccessKind("turnedOn");
      setPhase("success");
      afterBeat(onLinked);
    } catch {
      setPhase(null);
      setBusy(false);
      customAlert(t("turnOnFailedTitle"), t("turnOnFailedBody"));
    }
  };

  /** Turn off, keeping the card (removing it lives in the Card sheet). */
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callAuthed(router, (jwt) => disablePayg({ jwt }), {
        handleSpecificErrorManually: true,
      });
      setBusy(false);
      // 1353 = already off — converge on the off state.
      const code = !res.ok ? res.error?.error.code : undefined;
      const alreadyOff = code === 1353;
      if (!res.ok && !alreadyOff) {
        if (typeof code === "number" && code >= 1000) {
          customAlert(t("turnOffFailedTitle"), t("turnOffFailedBody"));
        }
        return;
      }
      if (res.ok) track("payg_turned_off", { surface });
      qc.setQueryData<GetPaygStateResponse>(PAYG_STATE_QUERY_KEY, (p) =>
        p
          ? {
              ...p,
              active: false,
              status: "NOT_LINKED",
              lastEndedReason: "DISABLED",
            }
          : p,
      );
      await now(() => {
        onChanged?.();
        onClose();
      });
    } catch {
      setBusy(false);
      customAlert(t("turnOffFailedTitle"), t("turnOffFailedBody"));
    }
  };

  const confirmTurnOff = () =>
    customAlert(t("turnOffTitle"), t("turnOffBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: tb("action.turnOff"),
        style: "destructive",
        onPress: () => void turnOff(),
      },
    ]);

  const closable = phase === "unverified" || (phase === null && !busy);

  const consentLine = needsCheckbox ? (
    <ConsentCheckbox
      checked={consented}
      onToggle={() => setConsented((v) => !v)}
      label={t("consent", { surcharge })}
    />
  ) : (
    <Text style={[text.caption, { color: color.text.secondary }]}>
      {t("disclosure", { surcharge })}
    </Text>
  );

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
                ? successKind === "turnedOn"
                  ? t("turnOnSuccessTitle")
                  : t("successTitle")
                : t("unverifiedTitle")
          }
          body={
            phase === "verifying"
              ? t("verifyingBody")
              : phase === "success"
                ? successKind === "turnedOn"
                  ? t("turnOnSuccessBody")
                  : t("successBody")
                : t("unverifiedBody")
          }
          ctaLabel={t("unverifiedCta")}
          onCtaPress={onClose}
        />
      ) : funding.loading ? (
        <View
          style={{
            minHeight: 180,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color={color.ink} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <MethodHeader
            method="payg"
            trailing={
              payg.active ? (
                <StatusPill label={tb("state.active")} tone="success" />
              ) : chargeFailed ? (
                <StatusPill label={tb("state.cardIssue")} tone="danger" />
              ) : hasCard ? (
                <StatusPill label={tb("state.off")} tone="neutral" />
              ) : null
            }
          />

          {payg.active ? (
            /* Running: state, then the one action that changes it. Anything
               about the card itself belongs to the Card sheet. */
            <>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("activeNote", { surcharge })}
              </Text>
              <CustomButton
                type="soft"
                label={t("manageCard")}
                icon="card-outline"
                onPress={onOpenCard}
                disabled={busy}
              />
              <CustomButton
                type="destructive"
                label={tb("action.turnOff")}
                icon="power-outline"
                onPress={confirmTurnOff}
                disabled={busy}
              />
            </>
          ) : chargeFailed ? (
            /* The card that declined is the account's card — updating it is a
               card action, so it opens the Card sheet. */
            <>
              <Text style={[text.caption, { color: color.danger }]}>
                {t("failedNote")}
              </Text>
              <CustomButton
                type="primary"
                label={tb("action.updateCard")}
                icon="card-outline"
                onPress={onOpenCard}
                disabled={busy}
              />
            </>
          ) : paygOff ? (
            /* A card is on file (added for itself, or for the monthly top-up)
               — turning PAYG on needs no PaymentSheet, only the mandate. */
            <>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("offNote")}
              </Text>
              {consentLine}
              <CustomButton
                type="primary"
                label={t("turnOn")}
                icon="flash-outline"
                onPress={() => void turnOn()}
                loading={busy}
                disabled={needsCheckbox && !consented}
              />
            </>
          ) : (
            /* No card — the full pitch, then link + turn on in one step. */
            <>
              <MethodBenefits method="payg" card heading />
              {consentLine}
              <CustomButton
                type="primary"
                label={t("cta")}
                onPress={() => void linkAndTurnOn()}
                loading={busy}
                disabled={needsCheckbox && !consented}
              />
              <Text
                style={[
                  text.micro,
                  { color: color.text.tertiary, textAlign: "center" },
                ]}
              >
                {t("footnote")}
              </Text>
            </>
          )}
        </View>
      )}
    </BottomSheet>
  );
}
