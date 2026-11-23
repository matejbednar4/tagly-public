import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  withAlpha,
} from "@tagly/client";
import { isEULocale, PAYG } from "@tagly/models/shared";
import type { GetPaygStateResponse } from "@tagly/models/v2/advertiserApp";
import { removeSavedCard } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import {
  PaymentPhaseView,
  type PaymentVerifyPhase,
} from "@/components/billing/PaymentPhaseView";
import { BenefitRow } from "@/components/billing/shared/MethodBenefits";
import { StatusPill } from "@/components/billing/shared/StatusPill";
import { ConsentCheckbox } from "@/components/billing/shared/ConsentCheckbox";
import { useCardLink } from "@/components/billing/shared/useCardLink";
import { useFundingState } from "@/components/billing/shared/useFundingState";
import { MONTHLY_BUDGET_STATE_QUERY_KEY } from "@/components/billing/shared/useMonthlyBudgetState";
import { PAYG_STATE_QUERY_KEY } from "@/components/billing/shared/usePaygState";
import { SAVED_CARD_QUERY_KEY } from "@/components/billing/shared/useSavedCard";
import { useConfirmedExit } from "@/components/billing/shared/useConfirmedExit";
import { useCardLabels } from "@/components/billing/shared/useCardLabels";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/**
 * The payment card — the one place the account's ONE off-session card is
 * managed, and the one place that answers "what is my card actually doing".
 *
 * That question used to have no home: the card was drawn inside both the PAYG
 * and monthly sheets, so removing it had to stop and explain in an alert which
 * other feature it was about to break. Here the jobs are listed on the card
 * itself, so the remove button can simply name its consequences up front
 * (borrowed from proposal B in the 2026-09-02 restructure).
 *
 * States:
 * - **No card** — the two jobs explained before the card is asked for, so the
 *   ask has a visible reason, then "Add card". Adding a card enables NOTHING:
 *   each rule is turned on in its own sheet. That is what makes the card a
 *   plain object rather than a hidden switch.
 * - **Card on file** — brand, last4, expiry, plus a row per job with its live
 *   state, then replace / remove.
 *
 * Removal is the only destructive action here: it closes both periods
 * server-side (`removeSavedCard`), so the confirm names whichever rules are
 * actually running rather than a generic warning.
 */
export function CardSheet({
  open,
  onClose,
  onClosed,
  onChanged,
  surface,
}: {
  open: boolean;
  onClose: () => void;
  /** Forwarded to BottomSheet so the host knows when the surface is empty
   *  (`useSheetRouter`) — two Modals must never be mounted at once. */
  onClosed?: () => void;
  /** The card was added, replaced or removed — hosts re-pull /me. */
  onChanged: () => void;
  surface: BillingSurface;
}) {
  const { t } = useTranslation("cardSheet");
  const { t: tb } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const qc = useQueryClient();
  const { advertiser } = useAdvertiser();
  const { track } = useAnalytics();
  const { linkCard } = useCardLink();
  const { afterBeat, now } = useConfirmedExit();

  const needsCheckbox = !advertiser || isEULocale(advertiser.locale);
  const funding = useFundingState({ enabled: open });
  const { card, hasCard, monthly, payg } = funding;

  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<PaymentVerifyPhase | null>(null);
  const [phaseCopy, setPhaseCopy] = useState<{ title: string; body: string }>({
    title: "",
    body: "",
  });
  useEffect(() => {
    if (open) {
      setPhase(null);
      setBusy(false);
      setConsented(false);
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

  const surcharge = formatBudget(PAYG.SURCHARGE_CENTS);

  /** Add a card, or replace the one on file. Enables no feature either way. */
  const link = async () => {
    if (busy) return;
    setBusy(true);
    // Snapshot before the reconcile invalidates the cache — afterwards there is
    // no way to tell a fresh link from a replacement.
    const action = hasCard ? ("update" as const) : ("link" as const);
    try {
      const outcome = await linkCard({
        onVerifying: () =>
          showPhase("verifying", {
            title: t("verifyingTitle"),
            body: t("verifyingBody"),
          }),
      });
      if (outcome === "cancelled") {
        restoreForm();
        return;
      }
      if (outcome === "failed") {
        restoreForm();
        customAlert(t("alertTitle"), t("alertBody"));
        return;
      }
      if (outcome === "unverified") {
        showPhase("unverified", {
          title: t("unverifiedTitle"),
          body: t("unverifiedBody"),
        });
        setBusy(false);
        return;
      }
      track("payg_card_linked", { surface, action });
      showPhase("success", {
        title: action === "update" ? t("replacedTitle") : t("addedTitle"),
        body: action === "update" ? t("replacedBody") : t("addedBody"),
      });
      afterBeat(() => {
        restoreForm();
        onChanged();
      });
    } catch {
      restoreForm();
      customAlert(t("alertTitle"), t("alertBody"));
    }
  };

  /** Remove the card — closes both periods server-side. */
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callAuthed(router, (jwt) => removeSavedCard({ jwt }), {
        handleSpecificErrorManually: true,
      });
      setBusy(false);
      // 1338 = no card on file — already removed elsewhere and this view is
      // stale. The goal is met, so converge on the removed state.
      const code = !res.ok ? res.error?.error.code : undefined;
      const alreadyRemoved = code === 1338;
      if (!res.ok && !alreadyRemoved) {
        if (typeof code === "number" && code >= 1000) {
          customAlert(t("removeFailedTitle"), t("removeFailedBody"));
        }
        return;
      }
      if (res.ok) track("payg_card_unlinked", { surface });
      // The card is gone and PAYG went with it — the outcome is fully known,
      // so patch that cache directly; the monthly state's exact shape is not,
      // so refetch it.
      qc.setQueryData<GetPaygStateResponse>(PAYG_STATE_QUERY_KEY, (p) =>
        p
          ? {
              ...p,
              hasCard: false,
              card: null,
              active: false,
              status: "NOT_LINKED",
              lastEndedReason: "CARD_REMOVED",
            }
          : p,
      );
      void qc.invalidateQueries({ queryKey: SAVED_CARD_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY });
      await now(() => {
        onChanged();
        onClose();
      });
    } catch {
      setBusy(false);
      customAlert(t("removeFailedTitle"), t("removeFailedBody"));
    }
  };

  /** Name exactly what stops — never a generic warning. */
  const confirmRemove = () => {
    const stops = [
      monthly.active || monthly.status === "CARD_FAILED"
        ? tb("monthlyBudget.title")
        : null,
      payg.active || payg.status === "CARD_FAILED" ? tb("payg.title") : null,
    ].filter((s): s is string => s !== null);
    customAlert(
      t("removeTitle"),
      stops.length > 0
        ? t("removeBodyStops", { stops: stops.join(" · ") })
        : t("removeBody"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: tb("action.removeCard"),
          style: "destructive",
          onPress: () => void remove(),
        },
      ],
    );
  };

  const closable = phase === "unverified" || (phase === null && !busy);

  const labels = useCardLabels(card);
  const cardLabel = labels.label || t("cardLinked");
  const cardExpiry = labels.expiry || null;

  /** One job row: what the card does, and whether it's doing it. */
  const jobRow = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    value: string,
    tone: "success" | "danger" | "neutral",
  ) => (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
    >
      <Ionicons name={icon} size={16} color={color.text.secondary} />
      <Text style={[text.bodyMedium, { color: color.text.primary, flex: 1 }]}>
        {title}
      </Text>
      <StatusPill label={value} tone={tone} size="sm" />
    </View>
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
          title={phaseCopy.title}
          body={phaseCopy.body}
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
      ) : hasCard ? (
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(color.ink, 0.08),
              }}
            >
              <Ionicons name="card-outline" size={20} color={color.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.heading, { color: color.text.primary }]}>
                {cardLabel}
              </Text>
              {cardExpiry ? (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {cardExpiry}
                </Text>
              ) : null}
            </View>
          </View>

          {/* What this card is doing — the whole reason the sheet exists. */}
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
              boxShadow: shadow.card,
              gap: spacing.md,
            }}
          >
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {tb("card.jobsHeading")}
            </Text>
            {jobRow(
              "repeat-outline",
              tb("monthlyBudget.title"),
              monthly.active
                ? monthly.pendingRetry
                  ? tb("state.retrying")
                  : tb("state.on")
                : monthly.status === "CARD_FAILED"
                  ? tb("state.paused")
                  : tb("state.off"),
              monthly.active && !monthly.pendingRetry
                ? "success"
                : monthly.pendingRetry || monthly.status === "CARD_FAILED"
                  ? "danger"
                  : "neutral",
            )}
            <View
              style={{ height: 1, backgroundColor: color.border.divider }}
            />
            {jobRow(
              "flash-outline",
              tb("payg.title"),
              payg.active
                ? tb("state.on")
                : payg.status === "CARD_FAILED"
                  ? tb("state.cardIssue")
                  : tb("state.off"),
              payg.active
                ? "success"
                : payg.status === "CARD_FAILED"
                  ? "danger"
                  : "neutral",
            )}
          </View>

          <CustomButton
            type="soft"
            label={tb("action.replaceCard")}
            icon="card-outline"
            onPress={() => void link()}
            loading={busy}
          />
          <CustomButton
            type="destructive"
            label={tb("action.removeCard")}
            icon="trash-outline"
            onPress={confirmRemove}
            disabled={busy}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(color.ink, 0.08),
              }}
            >
              <Ionicons name="card-outline" size={20} color={color.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.heading, { color: color.text.primary }]}>
                {t("addTitle")}
              </Text>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("addTagline")}
              </Text>
            </View>
          </View>

          {/* The jobs are explained BEFORE the card is asked for, so the ask
              has a visible reason. Adding a card turns neither of them on. */}
          <View style={{ paddingHorizontal: spacing.xs, gap: spacing.md }}>
            <BenefitRow
              icon="repeat-outline"
              title={tb("monthlyBudget.title")}
              sub={t("jobMonthlySub")}
            />
            <BenefitRow
              icon="flash-outline"
              title={tb("payg.title")}
              sub={t("jobPaygSub", { surcharge })}
            />
          </View>

          {needsCheckbox ? (
            <ConsentCheckbox
              checked={consented}
              onToggle={() => setConsented((v) => !v)}
              label={t("consent")}
            />
          ) : (
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {t("disclosure")}
            </Text>
          )}

          <CustomButton
            type="primary"
            label={tb("action.addCard")}
            onPress={() => void link()}
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
        </View>
      )}
    </BottomSheet>
  );
}
