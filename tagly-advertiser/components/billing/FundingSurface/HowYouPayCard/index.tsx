import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme, useFormatBudget } from "@tagly/client";
import { MethodRow } from "@/components/billing/shared/MethodRow";
import { formatChargeDate } from "@/components/billing/shared/formatChargeDate";
import { useCardLabels } from "@/components/billing/shared/useCardLabels";
import type { FundingState } from "@/components/billing/shared/useFundingState";

/**
 * "How you pay" — the three rules of the account as rows: monthly top-up, pay
 * as you go, and the card they share. A row REPORTS and opens a sheet; it never
 * pitches, which is what stops a funded advertiser from being re-sold a method
 * they already declined (the old wallet gave each one a full card, so having
 * chosen one made the others read as things you were missing).
 *
 * **Every fault surfaces on the row it belongs to** (Matej, 2026-09-02) — a
 * declined card shows on the card row AND as the paused state of whichever
 * rule stopped, never on the balance card above. The row a fault appears on is
 * also the row that opens the sheet which fixes it.
 *
 * Order is the order money is actually spent: credits are topped up first, the
 * card covers what is left, and the card itself sits last as the shared object
 * both rules depend on.
 *
 * **The card row appears when there is a card on file, or when anything is
 * failing** (Matej, 2026-09-02). A saved card with no rule attached does
 * nothing — it funds no share and refills no balance — so an empty
 * "Card · None" row offers a step that accomplishes nothing, and every path
 * that genuinely needs a card already offers to link one at the moment it is
 * needed ("Link card and turn on"), where the reason is visible. A card with
 * both rules off still shows: it is a stored payment method, and the
 * advertiser must be able to see and delete it.
 *
 * The `|| cardFailed` half is deliberate belt-and-braces. Server-side the two
 * facts cannot come apart — `derivePaygStatus` returns NOT_LINKED before it can
 * reach CARD_FAILED when there is no card, and `deriveMonthlyBudgetStatus`
 * gates CARD_FAILED on `cardOnFile` — so a *settled* `!hasCard && CARD_FAILED`
 * is unreachable. But it is reachable **while loading**: `useFundingState`
 * seeds `payg.status` from the `/me` budgets before the card query resolves,
 * so a failing card would otherwise make this row flicker out and back. And in
 * money UI the asymmetry decides it anyway: showing a "Declined" row that
 * shouldn't exist is harmless, while hiding the only route to fixing a broken
 * card is not. This row must never be the thing that hides a fault.
 */
export function HowYouPayCard({
  funding,
  onMonthly,
  onPayg,
  onCard,
}: {
  funding: FundingState;
  onMonthly: () => void;
  onPayg: () => void;
  onCard: () => void;
}) {
  const { t, i18n } = useTranslation("fundingSurface");
  const { t: tb } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const formatBudget = useFormatBudget();
  const { monthly, payg, card, hasCard } = funding;
  const cardLabels = useCardLabels(card);

  // ── Monthly top-up ────────────────────────────────────────────────────────
  const monthlyPaused = monthly.status === "CARD_FAILED";
  const monthlyValue = monthly.active
    ? monthly.pendingRetry
      ? tb("state.retrying")
      : tb("monthlyBudget.perMonth", {
          amount: formatBudget(monthly.targetCents ?? 0, {
            forcedCurrency: "USD",
            showCents: false,
          }),
        })
    : monthlyPaused
      ? tb("state.paused")
      : tb("state.off");
  // Date + amount in ONE sentence — the exact same key the sheet renders, so
  // the row and the sheet can never word the same charge differently. The
  // amount is the worker's own rule, computed once in `useFundingState`.
  const monthlySub =
    monthly.active && !monthly.pendingRetry && monthly.nextChargeAt
      ? tb(
          monthly.estimateCents > 0
            ? "monthlyBudget.chargeLine"
            : "monthlyBudget.chargeLineZero",
          {
            date: formatChargeDate(monthly.nextChargeAt, i18n.language),
            amount: formatBudget(monthly.estimateCents, {
              forcedCurrency: "USD",
            }),
          },
        )
      : monthly.pendingRetry || monthlyPaused
        ? t("monthlyFault")
        : undefined;

  // ── Pay as you go ─────────────────────────────────────────────────────────
  const paygFailed = payg.status === "CARD_FAILED";
  const paygValue = payg.active
    ? tb("state.on")
    : paygFailed
      ? tb("state.cardIssue")
      : tb("state.off");

  // ── Card (rendered only when on file or failing — see the docblock) ──────
  const cardFailed = paygFailed || monthlyPaused || monthly.pendingRetry;
  const cardValue = cardFailed
    ? tb("card.declined")
    : cardLabels.label || tb("state.on");

  return (
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
        {tb("howYouPay")}
      </Text>

      <MethodRow
        icon="repeat-outline"
        tone={
          monthly.pendingRetry || monthlyPaused
            ? "danger"
            : monthly.active
              ? "on"
              : "off"
        }
        title={tb("monthlyBudget.title")}
        sub={monthlySub}
        value={monthlyValue}
        onPress={onMonthly}
      />

      <View style={{ height: 1, backgroundColor: color.border.divider }} />

      <MethodRow
        icon="flash-outline"
        tone={paygFailed ? "danger" : payg.active ? "payg" : "off"}
        title={tb("payg.title")}
        sub={payg.active ? tb("payg.afterCredits") : undefined}
        value={paygValue}
        onPress={onPayg}
      />

      {hasCard || cardFailed ? (
        <>
          <View style={{ height: 1, backgroundColor: color.border.divider }} />
          <MethodRow
            icon="card-outline"
            tone={cardFailed ? "danger" : "on"}
            title={tb("card.title")}
            value={cardValue}
            onPress={onCard}
          />
        </>
      ) : null}
    </View>
  );
}
