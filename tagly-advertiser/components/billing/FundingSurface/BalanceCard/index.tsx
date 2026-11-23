import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  useTheme,
  useFormatBudget,
  CustomButton,
  pressFeedbackStyle,
} from "@tagly/client";
import { VISIBILITY_BUDGETS } from "@tagly/models/shared";
import { LockedBudgetSheet } from "@/components/billing/LockedBudgetSheet";
import type { FundingState } from "@/components/billing/shared/useFundingState";

/**
 * The balance card — **balance facts only** (Matej, 2026-09-02). Available and
 * Locked as two peer cells, a note when the balance itself is the problem, and
 * the actions that change it.
 *
 * The scoping rule matters more than the layout: a declined card, a paused
 * monthly top-up, a pay-as-you-go fault are NOT balance facts and never appear
 * here — they belong to their own row in `HowYouPayCard`, where the fix also
 * lives. Putting a rule's failure on the balance card was how the old wallet
 * ended up with three surfaces all shouting about the same card.
 *
 * So exactly two notes can appear, both about the money itself:
 * - **negative** — an uncollected charge left a debt; settling it is the
 *   primary action and topping up steps down to secondary.
 * - **below the visibility floor** — a positive balance too small to keep the
 *   business visible. Skipped while pay as you go is active, which is the one
 *   case where the floor does not gate visibility (the same exemption the
 *   backend encodes in `isInLowBudgetWarningBand`).
 *
 * "Locked" is money reserved for active shares — a peer figure, not a
 * footnote; tapping it opens the shared explainer sheet (the only place the
 * concept is described).
 */
export function BalanceCard({
  funding,
  onAddCredits,
  onPayBalance,
}: {
  funding: FundingState;
  onAddCredits: () => void;
  onPayBalance: () => void;
}) {
  const { t } = useTranslation("fundingSurface");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const formatBudget = useFormatBudget();
  const [lockedSheetOpen, setLockedSheetOpen] = useState(false);

  const { availableCents, lockedCents, negative, payg } = funding;

  // A positive-but-too-small balance reads as "working" unless we say
  // otherwise. PAYG-active accounts are exempt: their card funds every share,
  // so visibility never depends on the credits floor.
  const belowVisibilityFloor =
    !negative &&
    !payg.active &&
    availableCents < VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS;

  const availableCzk =
    availableCents !== 0
      ? formatBudget(Math.abs(availableCents), { asCzkSecondaryLine: true })
      : "";
  const lockedCzk =
    lockedCents > 0
      ? formatBudget(lockedCents, { asCzkSecondaryLine: true })
      : "";

  return (
    <>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
          gap: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          <View style={{ flex: 1, gap: spacing.xs, paddingRight: spacing.lg }}>
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {t("available")}
            </Text>
            <Text
              style={[
                text.amountLg,
                { color: negative ? color.danger : color.text.primary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatBudget(availableCents, { forcedCurrency: "USD" })}
            </Text>
            {availableCzk ? (
              <Text style={[text.caption, { color: color.text.tertiary }]}>
                {availableCzk}
              </Text>
            ) : null}
          </View>

          <View style={{ width: 1, backgroundColor: color.border.divider }} />

          {/* Locked → the shared explainer (an info glyph marks it tappable). */}
          <Pressable
            onPress={() => setLockedSheetOpen(true)}
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
              { flex: 1, gap: spacing.xs, paddingLeft: spacing.lg },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {t("locked")}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={color.text.tertiary}
              />
            </View>
            <Text
              style={[text.amountLg, { color: color.text.secondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatBudget(lockedCents, { forcedCurrency: "USD" })}
            </Text>
            {lockedCzk ? (
              <Text style={[text.caption, { color: color.text.tertiary }]}>
                {lockedCzk}
              </Text>
            ) : null}
          </Pressable>
        </View>

        {negative ? (
          <Text style={[text.caption, { color: color.danger }]}>
            {t("negativeHint")}
          </Text>
        ) : belowVisibilityFloor ? (
          <Text style={[text.caption, { color: color.danger }]}>
            {t("belowMinHint", {
              min: formatBudget(
                VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS,
                {
                  forcedCurrency: "USD",
                  showCents: false,
                },
              ),
            })}
          </Text>
        ) : null}

        {negative ? (
          // Owe money → settling is the primary action; topping up steps down.
          <View style={{ gap: spacing.sm }}>
            <CustomButton
              type="primary"
              label={t("payBalance")}
              icon="card-outline"
              onPress={onPayBalance}
            />
            <CustomButton
              type="secondary"
              label={t("addCredits")}
              icon="add"
              onPress={onAddCredits}
            />
          </View>
        ) : (
          <CustomButton
            type="primary"
            label={t("addCredits")}
            icon="add"
            onPress={onAddCredits}
          />
        )}
      </View>
      <LockedBudgetSheet
        open={lockedSheetOpen}
        onClose={() => setLockedSheetOpen(false)}
      />
    </>
  );
}
