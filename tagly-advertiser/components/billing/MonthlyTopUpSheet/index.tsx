import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { MONTHLY_BUDGET, isEULocale } from "@tagly/models/shared";
import { disableMonthlyBudget } from "@tagly/sdk/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import {
  PaymentPhaseView,
  type PaymentVerifyPhase,
} from "@/components/billing/PaymentPhaseView";
import {
  MethodChip,
  MethodHeader,
} from "@/components/billing/shared/MethodHeader";
import { MethodBenefits } from "@/components/billing/shared/MethodBenefits";
import { StatusPill } from "@/components/billing/shared/StatusPill";
import { ConsentCheckbox } from "@/components/billing/shared/ConsentCheckbox";
import { useFundingState } from "@/components/billing/shared/useFundingState";
import { MONTHLY_BUDGET_STATE_QUERY_KEY } from "@/components/billing/shared/useMonthlyBudgetState";
import { formatChargeDate } from "@/components/billing/shared/formatChargeDate";
import { useMonthlyEnable } from "@/components/billing/shared/useMonthlyEnable";
import { useConfirmedExit } from "@/components/billing/shared/useConfirmedExit";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/** Preset monthly amounts (USD cents). */
const PRESETS_CENTS = [100_00, 250_00, 500_00];
const DEFAULT_PRESET_CENTS = 250_00;

/**
 * Monthly top-up — the recurring rule, and nothing else. One verb per sheet is
 * the point of the 2026-09-02 restructure: buying credits is a transaction and
 * lives in `AddCreditsSheet`; this sheet only ever turns the rule on, changes
 * its amount, or turns it off.
 *
 * States:
 * - **Off (or paused after repeated declines)** — the canonical pitch, the
 *   amount selector, the recurring-charge consent (EU checkbox / US
 *   disclosure) and the enable CTA. With no card on file the CTA links one
 *   first via the shared `useCardLink`; a paused budget re-links too, since the
 *   card that declined is the one on file.
 * - **Active** — the summary (amount, next charge, what it will cost at
 *   today's balance) plus its three actions: change the amount, update the
 *   card (handed to the Card sheet — this sheet never manages cards), turn off.
 *
 * `PUT /monthly-budget` only opens the period, scheduled for the next 1st, and
 * **the stripe worker is the only thing that ever charges one**. So turning it
 * on moves no money and there is no run to wait for: no polling, no
 * declined/retrying/unverified outcomes, and no CTA quoting a pay-now amount.
 * The success beat says nothing was charged and names when the first charge
 * lands; the exact date arrives a beat later from `GET /monthly-budget`.
 *
 * **Solicited vs not** (`afterPurchase` → `prompted`): opened from its row the
 * sheet goes straight to the form. Opened by the surface on the back of a
 * purchase it is an unsolicited offer, so it puts a **question step in front**
 * — yes reveals the same form, no closes — rather than reshaping the form
 * itself. Declining something you never asked for gets a real button instead
 * of a hunt for the X, and the form stays one thing however it was reached.
 *
 * Containment: non-dismissable while busy / verifying / celebrating, so every
 * flow runs inside a try/catch that restores the dismissable form.
 */
export function MonthlyTopUpSheet({
  open,
  onClose,
  onClosed,
  onEnabled,
  onChanged,
  onOpenCard,
  afterPurchase = false,
  surface,
}: {
  open: boolean;
  onClose: () => void;
  /** Forwarded to BottomSheet so the host can chain sheets safely
   *  (`useSheetRouter`) — two Modals must never be mounted at once. */
  onClosed?: () => void;
  /** Turned on and server-confirmed — the account is funded. */
  onEnabled: () => void;
  /** Amount changed or turned off (no new funding). */
  onChanged?: () => void;
  /** Hands card management to the Card sheet (this sheet owns no card UI). */
  onOpenCard: () => void;
  /** Opened as the offer right after a credit purchase, rather than from a row.
   *  Puts the yes/no question step in front of the form (see `prompted`). */
  afterPurchase?: boolean;
  surface: BillingSurface;
}) {
  const { t, i18n } = useTranslation("monthlyTopUpSheet");
  const { t: tb } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const router = useRouter();
  const qc = useQueryClient();
  const { advertiser } = useAdvertiser();
  const { track } = useAnalytics();
  const { enable } = useMonthlyEnable();
  const { afterBeat, now } = useConfirmedExit();

  const needsCheckbox = !advertiser || isEULocale(advertiser.locale);
  const funding = useFundingState({ enabled: open });
  const { monthly, hasCard, availableCents } = funding;

  const [amount, setAmount] = useState(String(DEFAULT_PRESET_CENTS / 100));
  const [editing, setEditing] = useState(false);
  const [consented, setConsented] = useState(false);
  /** The offer step is done with — they said yes and want the form. */
  const [offerAnswered, setOfferAnswered] = useState(false);
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
      setEditing(false);
      setOfferAnswered(false);
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
  const belowMin = amountCents < MONTHLY_BUDGET.MIN_TARGET_CENTS;
  const aboveMax = amountCents > MONTHLY_BUDGET.MAX_TARGET_CENTS;
  const valid = !belowMin && !aboveMax;
  const amountLabel = formatBudget(amountCents, { showCents: false });
  const unchanged =
    editing && monthly.targetCents != null
      ? amountCents === monthly.targetCents
      : false;

  /**
   * Turn on, or save a new amount. **Nothing here charges** — the period is
   * scheduled for the next 1st and the stripe worker is the only thing that
   * ever runs one, so there is no outcome to poll for: link a card if needed,
   * set the target, state the date.
   */
  const save = async () => {
    if (busy || !valid) return;
    setBusy(true);
    const updating = monthly.active;
    try {
      const { outcome, linkedCard } = await enable({
        targetCents: amountCents,
        // A paused (CARD_FAILED) budget re-links first: the card on file is
        // the one that declined.
        needsCard: !hasCard || (!updating && monthly.status === "CARD_FAILED"),
        onVerifyingCard: () =>
          showPhase("verifying", {
            title: t("verifyingCardTitle"),
            body: t("verifyingCardBody"),
          }),
      });

      if (outcome === "cancelled") {
        restoreForm();
        return;
      }
      if (outcome === "failed") {
        restoreForm();
        customAlert(t("cardAlertTitle"), t("cardAlertBody"));
        return;
      }
      if (outcome === "cardUnverified") {
        showPhase("unverified", {
          title: t("unverifiedCardTitle"),
          body: t("unverifiedCardBody"),
        });
        setBusy(false);
        return;
      }

      if (updating) {
        track("monthly_budget_updated", { targetCents: amountCents, surface });
      } else {
        track("monthly_budget_enabled", {
          targetCents: amountCents,
          surface,
          linkedCard,
        });
      }

      // The one thing the advertiser needs to know: nothing was charged, and
      // when it first will be. The copy says "the 1st of next month" rather
      // than a date — the PUT returns only `{ active: true }`, and mirroring
      // the backend's CHARGE_HOUR_UTC here just to render one sentence would
      // duplicate a constant the client has no other use for. The exact date
      // lands a beat later from `GET /monthly-budget`, on the row and in this
      // sheet's active summary.
      showPhase("success", {
        title: updating ? t("successUpdatedTitle") : t("successTitle"),
        body: t("successBody", { amount: amountLabel }),
      });
      afterBeat(updating ? () => onChanged?.() ?? onClose() : onEnabled);
    } catch {
      restoreForm();
      customAlert(t("alertTitle"), t("alertBody"));
    }
  };

  /** Turn off, keeping the card (removing it lives in the Card sheet). */
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callAuthed(
        router,
        (jwt) => disableMonthlyBudget({ jwt }),
        { handleSpecificErrorManually: true },
      );
      setBusy(false);
      // 1351 / 1338 = already off / no card — the view is stale but the goal is
      // met; converge on the off state.
      const code = !res.ok ? res.error?.error.code : undefined;
      const alreadyOff = code === 1351 || code === 1338;
      if (!res.ok && !alreadyOff) {
        if (typeof code === "number" && code >= 1000) {
          customAlert(t("disableFailedTitle"), t("disableFailedBody"));
        }
        return;
      }
      if (res.ok)
        track("monthly_budget_disabled", { surface, removedCard: false });
      void qc.invalidateQueries({ queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY });
      await now(() => {
        onChanged?.();
        onClose();
      });
    } catch {
      setBusy(false);
      customAlert(t("disableFailedTitle"), t("disableFailedBody"));
    }
  };

  const confirmTurnOff = () =>
    customAlert(t("disableTitle"), t("disableBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("disableConfirm"),
        style: "destructive",
        onPress: () => void turnOff(),
      },
    ]);

  const closable = phase === "unverified" || (phase === null && !busy);

  /**
   * The sheet is making an unsolicited offer: it opened itself on the back of a
   * purchase rather than being asked for, so the question step goes first. Only
   * while the rule is genuinely off — a race that finds it already active is a
   * management screen, and there is nothing to offer.
   */
  const prompted = afterPurchase && !monthly.active;

  const amountForm = (
    <>
      {/* The question owns the whole amount block — presets first, the typed
          field as its escape hatch — so it sits above the chips and outranks
          the field's own label. */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[text.bodyMedium, { color: color.text.primary }]}>
          {t("amountQuestion")}
        </Text>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
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
          selected on open), so placeholder copy would never be seen. It stays a
          quiet `subheading` — the question above owns the block; this only
          names the typed alternative to the chips. */}
      <CustomTextInput
        subheading={t("customLabel")}
        prefix="$"
        value={amount}
        onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
        // No `returnKeyType` on a keypad: it has no return key, so iOS floats a
        // "Done" pill over the sheet to host one. Every other keypad field in
        // the apps omits it for the same reason.
        keyboardType="number-pad"
        error={
          amount && belowMin
            ? t("minNote", {
                min: formatBudget(MONTHLY_BUDGET.MIN_TARGET_CENTS, {
                  showCents: false,
                }),
              })
            : aboveMax
              ? t("maxNote")
              : undefined
        }
      />
    </>
  );

  /** The active summary — amount, schedule, and what it costs at today's balance. */
  const summary = (
    <View
      style={{
        backgroundColor: color.surface,
        borderRadius: radius.structure,
        padding: layout.cardPadding,
        boxShadow: shadow.card,
        gap: spacing.sm,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Ionicons name="repeat-outline" size={18} color={color.ink} />
        <Text style={[text.bodyMedium, { color: color.text.primary, flex: 1 }]}>
          {tb("monthlyBudget.perMonth", {
            amount: formatBudget(monthly.targetCents ?? 0, {
              showCents: false,
            }),
          })}
        </Text>
        <StatusPill
          label={
            monthly.pendingRetry ? tb("state.retrying") : tb("state.active")
          }
          tone={monthly.pendingRetry ? "danger" : "success"}
          size="sm"
        />
      </View>
      {monthly.nextChargeAt ? (
        // The same sentence the "How you pay" row shows — one key, so the two
        // surfaces state this charge identically.
        <Text style={[text.caption, { color: color.text.secondary }]}>
          {tb(
            monthly.estimateCents > 0
              ? "monthlyBudget.chargeLine"
              : "monthlyBudget.chargeLineZero",
            {
              date: formatChargeDate(monthly.nextChargeAt, i18n.language),
              amount: formatBudget(monthly.estimateCents),
            },
          )}
        </Text>
      ) : null}
    </View>
  );

  /**
   * The offer step — the entire sheet when it opened itself on the back of a
   * purchase. It asks one question and does nothing else: yes hands over to the
   * form below, no closes. Keeping it a **separate step** is the point (Matej,
   * 2026-09-03): the form is then byte-identical however it was reached, where
   * bending its header and bolting a decline button onto it had a settings
   * screen and an unsolicited offer sharing one set of parts.
   *
   * Same centered-moment shape as `PaymentPhaseView`, so a decision and a
   * confirmation read as the same kind of beat.
   */
  const offer = (
    <View
      style={{
        alignItems: "center",
        gap: spacing.xl,
        paddingVertical: spacing.xl,
      }}
    >
      <MethodChip method="monthlyBudget" size={72} />
      <View style={{ gap: spacing.sm, alignItems: "center" }}>
        <Text
          style={[
            text.heading,
            { color: color.text.primary, textAlign: "center" },
          ]}
        >
          {t("promptTitle")}
        </Text>
        <Text
          style={[
            text.body,
            { color: color.text.secondary, textAlign: "center" },
          ]}
        >
          {t("promptBody")}
        </Text>
      </View>
      <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
        <CustomButton
          type="primary"
          label={t("offerYes")}
          icon="checkmark"
          onPress={() => setOfferAnswered(true)}
        />
        <CustomButton
          type="secondary"
          label={t("offerNo")}
          icon="close"
          onPress={onClose}
        />
      </View>
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
      ) : prompted && !offerAnswered ? (
        // Ahead of the loading check: the question needs none of the funding
        // queries, so the offer is up the instant the sheet is.
        offer
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
          <MethodHeader method="monthlyBudget" />

          {monthly.active && !editing ? (
            /* Running — the summary plus the three things you can do to it. */
            <>
              {summary}
              {monthly.pendingRetry ? (
                <Text style={[text.caption, { color: color.danger }]}>
                  {t("retryNote")}
                </Text>
              ) : null}
              {/* Two-up row: at half width a button has ~115px for text after
                  its padding, icon and gap. "Změnit částku" fits; the card's
                  full verb ("Aktualizovat kartu") does not, so there the icon
                  carries the verb and the label carries the object — the
                  summary directly above already says which card it is. */}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <CustomButton
                  type="soft"
                  label={tb("action.changeAmount")}
                  onPress={() => {
                    if (monthly.targetCents != null) {
                      setAmount(String(Math.round(monthly.targetCents / 100)));
                    }
                    setEditing(true);
                  }}
                  style={{ flex: 1 }}
                  disabled={busy}
                  icon="create-outline"
                />
                <CustomButton
                  type="soft"
                  label={tb("action.card")}
                  icon="card-outline"
                  onPress={onOpenCard}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
              </View>

              <CustomButton
                type="destructive"
                label={tb("action.turnOff")}
                icon="power-outline"
                onPress={confirmTurnOff}
                disabled={busy}
              />
            </>
          ) : monthly.active && editing ? (
            /* Re-targeting: periods are immutable, so a new amount tops up to
               it right away — the CTA states what that costs today. */
            <>
              {amountForm}
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("updateNote", { amount: amountLabel })}
              </Text>
              <CustomButton
                type="primary"
                label={
                  !valid
                    ? t("ctaInvalid")
                    : t("ctaUpdate", { amount: amountLabel })
                }
                onPress={() => void save()}
                loading={busy}
                disabled={!valid || unchanged}
              />
              <CustomButton
                type="secondary"
                label={t("cancel")}
                icon="close-outline"
                onPress={() => setEditing(false)}
                disabled={busy}
              />
            </>
          ) : (
            /* Off, or paused after repeated declines. */
            <>
              {monthly.status === "CARD_FAILED" ? (
                <Text style={[text.caption, { color: color.danger }]}>
                  {t("cardFailedNote")}
                </Text>
              ) : null}
              <MethodBenefits method="monthlyBudget" card heading />
              {amountForm}
              {needsCheckbox ? (
                <ConsentCheckbox
                  checked={consented}
                  onToggle={() => setConsented((v) => !v)}
                  label={t("consent", { amount: amountLabel })}
                />
              ) : (
                <Text style={[text.caption, { color: color.text.secondary }]}>
                  {t("disclosure", { amount: amountLabel })}
                </Text>
              )}
              <CustomButton
                type="primary"
                label={
                  !valid
                    ? t("ctaInvalid")
                    : !hasCard || monthly.status === "CARD_FAILED"
                      ? t("ctaLinkCard")
                      : t("ctaEnable")
                }
                onPress={() => void save()}
                loading={busy}
                disabled={!valid || (needsCheckbox && !consented)}
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
