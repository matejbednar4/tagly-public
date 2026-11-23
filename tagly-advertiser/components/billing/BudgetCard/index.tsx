import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme, useFormatBudget, pressFeedbackStyle } from "@tagly/client";
import { VISIBILITY_BUDGETS } from "@tagly/models/shared";
import type { PaygStatus } from "@tagly/models/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { LockedBudgetSheet } from "@/components/billing/LockedBudgetSheet";
import { VisibilitySheet } from "@/components/billing/VisibilitySheet";
import { useVisibilityCause } from "@/components/billing/shared/useVisibilityCause";

/**
 * The budget/visibility account card — one card, same skeleton in every state
 * (status on top, the funding ledger in the middle, optional action row at the
 * bottom). The ledger is Available | Pay as you go as two peer cells, with a
 * slim full-width Locked strip below (shown only when credits are reserved).
 * Reads the advertiser from context, while the host owns the billing sheets
 * (`onPressCredits`/`onPressPayg`) and the optional footer CTA; the Locked
 * strip opens the self-owned `LockedBudgetSheet`.
 *
 * States (derived from server facts — `visible`, `funded`, `budgets`):
 * - **healthy** (visible): a full-width green Visible band (stamp + reassurance,
 *   mirroring the danger band) over the ledger, which has dynamic emphasis
 *   (active method full-strength, inactive receded).
 * - **broken** (not visible): a danger band with just the NOT VISIBLE stamp +
 *   an info glyph; tapping it opens the `VisibilitySheet` with the specific
 *   cause from the shared `useVisibilityCause` (never funded / negative
 *   balance / card issue / under-minimum credits / generic ran-out) — the
 *   sheet owns all the cause prose. The muted ledger below still opens the
 *   sheets.
 *
 * All funding logic comes from the server: `budgets.paygStatus` is the
 * server-derived PAYG state, so no card rule is re-implemented here. The
 * only client-side numerics are trivial comparisons against the shared
 * `MIN_VISIBILITY_BUDGET_CENTS` constant and zero.
 *
 * The no-business prompt is deliberately NOT part of this card — see
 * `components/businesses/NoBusinessCard` (shares the stamp + footer pieces).
 */
export function BudgetCard({
  onPressCredits,
  onPressPayg,
  footer,
}: {
  onPressCredits: () => void;
  onPressPayg: () => void;
  /** Optional full-bleed ink footer row (e.g. Home's "Manage wallet"). */
  footer?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };
}) {
  const { t } = useTranslation("budgetCard");
  const { theme } = useTheme();
  const { color, layout, radius, shadow } = theme;
  const { advertiser } = useAdvertiser();

  // Tapping the Locked figure opens the shared explainer sheet (self-owned so
  // the host doesn't wire it).
  const [lockedSheetOpen, setLockedSheetOpen] = useState(false);
  // Tapping the danger band opens the "how visibility works" explainer.
  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);

  const budgets = advertiser?.budgets;
  const availableCents = budgets?.availableCents ?? 0;
  const lockedCents = budgets?.lockedCents ?? 0;
  const paygStatus: PaygStatus = budgets?.paygStatus ?? "NOT_LINKED";

  // healthy (visible) / broken (not visible). A failed /me (advertiser null)
  // renders healthy — fail-open, no false alarm. The specific cause (never
  // funded / negative balance / card issue / low credits / …) comes from the
  // shared `useVisibilityCause`; the card shows only the stamp, and the
  // explainer sheet owns the cause's full prose.
  const cause = useVisibilityCause();
  const state: "healthy" | "broken" = cause === null ? "healthy" : "broken";

  const ledger = (
    <LedgerCells
      availableCents={availableCents}
      lockedCents={lockedCents}
      paygStatus={paygStatus}
      muted={state !== "healthy"}
      onPressCredits={onPressCredits}
      onPressLocked={() => setLockedSheetOpen(true)}
      onPressPayg={onPressPayg}
    />
  );

  return (
    <>
      <View
        style={{
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {state === "healthy" ? (
          <>
            {/* Visible band — a full-width tinted strip with just the status
              stamp, mirroring the danger band's tone/skeleton (which adds an
              actionable explainer; the healthy state needs none). */}
            <View
              style={{
                backgroundColor: color.successBg,
                padding: layout.cardPadding,
              }}
            >
              <VisibleStamp label={t("visible")} />
            </View>
            <View style={{ padding: layout.cardPadding }}>{ledger}</View>
          </>
        ) : (
          <>
            {/* Danger band — just the stamp; the whole band is a tap target that
              opens the "how visibility works" explainer (all cause prose lives
              there, not on the card). An info glyph flags the affordance.
              Press feedback rides the inner content, not the full-bleed band,
              so the tinted strip stays flush to the card edges. */}
            <Pressable
              onPress={() => setVisibilitySheetOpen(true)}
              accessibilityRole="button"
              style={{
                backgroundColor: color.dangerBg,
                padding: layout.cardPadding,
              }}
            >
              {({
                pressed,
                hovered,
              }: {
                pressed: boolean;
                hovered?: boolean;
              }) => (
                <View
                  style={[
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                    pressFeedbackStyle({ pressed, hovered }),
                  ]}
                >
                  <NotVisibleStamp label={t("notVisible")} />
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={color.on.dangerBg}
                  />
                </View>
              )}
            </Pressable>
            {/* The two funding methods stay reachable by tapping the cells. */}
            <View style={{ padding: layout.cardPadding }}>{ledger}</View>
          </>
        )}
        {/* Ink-filled full-bleed footer — the whole row is the CTA; the card's
          overflow:hidden clips it to the bottom corners. */}
        {footer ? (
          <CardFooterCta
            icon={footer.icon}
            label={footer.label}
            onPress={footer.onPress}
          />
        ) : null}
      </View>
      <LockedBudgetSheet
        open={lockedSheetOpen}
        onClose={() => setLockedSheetOpen(false)}
      />
      <VisibilitySheet
        open={visibilitySheetOpen}
        onClose={() => setVisibilitySheetOpen(false)}
        cause={cause ?? "lapsed"}
      />
    </>
  );
}

/**
 * The ledger — Available | Pay as you go as two peer cells split by a hairline
 * (each label gets half the card, so neither Czech label can truncate or wrap),
 * with **Locked as a slim full-width strip below** (hairline on top), shown
 * only when something is actually reserved. Cramming Locked in as a third
 * column starved every label at phone width; as a footnote strip it reads as
 * the secondary fact it is, keeps the baselines aligned, and taps into the
 * explainer sheet.
 *
 * Emphasis is dynamic: a cell renders full-strength when its method is actually
 * carrying visibility (credits ≥ the $15 floor / PAYG ACTIVE) and recedes
 * otherwise; `muted` (the broken card) forces both to recede. The danger state
 * — Card issue — comes straight from the server-derived `paygStatus` and stays
 * danger-toned even when `muted`. Each region taps into its own sheet
 * (Available → add credits, PAYG → manage, Locked → the explainer).
 */
function LedgerCells({
  availableCents,
  lockedCents,
  paygStatus,
  muted,
  onPressCredits,
  onPressLocked,
  onPressPayg,
}: {
  availableCents: number;
  lockedCents: number;
  paygStatus: PaygStatus;
  muted?: boolean;
  onPressCredits: () => void;
  onPressLocked: () => void;
  onPressPayg: () => void;
}) {
  const { t } = useTranslation("budgetCard");
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const formatBudget = useFormatBudget();

  const creditsOn =
    !muted && availableCents >= VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS;
  // A sub-minimum (but positive) balance gets a "min to be visible" caption so
  // the number never silently reads as "working". PAYG-active accounts are
  // exempt: the card funds every share with no spend cap, so their visibility
  // never depends on the credits floor — same exemption the backend encodes in
  // `isInLowBudgetWarningBand` and the customer-side `isLowBudgetEstimate`.
  const creditsBelowMin =
    paygStatus !== "ACTIVE" &&
    availableCents > 0 &&
    availableCents < VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS;
  const paygDanger = paygStatus === "CARD_FAILED";
  const paygOn = !muted && paygStatus === "ACTIVE";
  // ≈ CZK courtesy line (CZ locale only; "" otherwise). Only meaningful with a
  // real balance — never annotate a $0.00 credits cell.
  const creditsCzk =
    availableCents > 0
      ? formatBudget(availableCents, { asCzkSecondaryLine: true })
      : "";

  // flex-start (not center): with the credits cell now taller than the tap
  // minimum, a centered layout would push slack below the value and stack with
  // the card padding. Top-aligning keeps every gap owned by the layout.
  const cell =
    (flex: number, padding: object) =>
    ({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
      {
        flex,
        gap: spacing.xs,
        minHeight: 44,
        justifyContent: "flex-start" as const,
        ...padding,
      },
      pressFeedbackStyle({ pressed, hovered }),
    ];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {/* Available — the hero balance. */}
        <Pressable
          onPress={onPressCredits}
          style={cell(1, { paddingRight: spacing.lg })}
        >
          <CellCaption label={t("available")} />
          {/* Amount + ≈ CZK share one baseline row (CZK beside the number, not
              below it). The number shrinks first if the pair gets tight. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: spacing.sm,
            }}
          >
            <Text
              style={[
                text.amountLg,
                {
                  color: creditsOn ? color.text.primary : color.text.tertiary,
                  flexShrink: 1,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatBudget(availableCents, { forcedCurrency: "USD" })}
            </Text>
            {creditsCzk ? (
              <Text
                style={[text.caption, { color: color.text.tertiary }]}
                numberOfLines={1}
              >
                {creditsCzk}
              </Text>
            ) : null}
          </View>
          {creditsBelowMin ? (
            <Text
              style={[text.micro, { color: color.danger }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t("creditsBelowMin", {
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
        </Pressable>

        <View style={{ width: 1, backgroundColor: color.border.divider }} />

        {/* Pay as you go — half the card, so the label + status fit on one
            line (numberOfLines=2 stays as a safety net for long locales). */}
        <Pressable
          onPress={onPressPayg}
          style={cell(1, { paddingLeft: spacing.lg })}
        >
          <CellCaption label={t("payg")} />
          {paygDanger ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={color.danger}
              />
              <Text
                style={[
                  text.bodyMedium,
                  { color: color.danger, flexShrink: 1 },
                ]}
                numberOfLines={2}
              >
                {t("paygCardIssue")}
              </Text>
            </View>
          ) : paygOn ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons name="flash-outline" size={16} color={color.success} />
              <Text
                style={[
                  text.bodyMedium,
                  { color: color.success, flexShrink: 1 },
                ]}
                numberOfLines={2}
              >
                {t("paygActive")}
              </Text>
            </View>
          ) : (
            <Text
              style={[text.bodyMedium, { color: color.text.tertiary }]}
              numberOfLines={2}
            >
              {paygStatus === "ACTIVE" ? t("paygActive") : t("cardNotLinked")}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Locked — a slim full-width footnote strip under the ledger, only when
          something is reserved: label left, amount (+ ≈ CZK) right, info glyph
          marking the tap → explainer sheet. */}
      {lockedCents > 0 ? (
        <>
          <View style={{ height: 1, backgroundColor: color.border.divider }} />
          <Pressable
            onPress={onPressLocked}
            // Visually slim; hitSlop keeps the tap area at the 44pt minimum.
            hitSlop={{ top: spacing.sm, bottom: spacing.sm }}
            style={({
              pressed,
              hovered,
            }: {
              pressed: boolean;
              hovered?: boolean;
            }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                minHeight: 28,
              },
              pressFeedbackStyle({ pressed, hovered }),
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={color.text.tertiary}
            />
            {/* The texts mix sizes (13-caption label/CZK, 15-amount value), so
                center-aligning their boxes leaves the baselines at different
                heights — the "off center" look. Baseline-align the text group
                instead; the icons stay center-aligned in the outer row. */}
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "baseline",
                gap: spacing.sm,
              }}
            >
              <Text
                style={[text.caption, { color: color.text.secondary, flex: 1 }]}
                numberOfLines={1}
              >
                {t("locked")}
              </Text>
              <Text
                style={[text.amountSm, { color: color.text.secondary }]}
                numberOfLines={1}
              >
                {formatBudget(lockedCents, { forcedCurrency: "USD" })}
              </Text>
            </View>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={color.text.tertiary}
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** A ledger cell's caption — the label plus a trailing glyph signalling the
 *  cell is tappable: a chevron for the sheet-openers (default), or an info glyph
 *  for the Locked explainer. */
function CellCaption({
  label,
  icon = "chevron-forward",
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
    >
      <Text
        style={[text.caption, { color: color.text.secondary, flexShrink: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name={icon} size={13} color={color.text.tertiary} />
    </View>
  );
}

/** The "VISIBLE" overline stamp at the top of a healthy card's green band —
 *  eye + uppercase label, the positive twin of `NotVisibleStamp`. */
function VisibleStamp({ label }: { label: string }) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
    >
      <Ionicons name="eye-outline" size={16} color={color.on.successBg} />
      <Text
        style={[
          text.label,
          {
            color: color.on.successBg,
            textTransform: "uppercase",
            letterSpacing: 1,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** The "NOT VISIBLE" overline stamp at the top of a card's danger band —
 *  eye-off + uppercase label. Exported for `NoBusinessCard`, which renders it
 *  in the same band so the stamp reads identically everywhere. */
export function NotVisibleStamp({ label }: { label: string }) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const tone = color.on.dangerBg;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Ionicons name="eye-off-outline" size={16} color={tone} />
      <Text
        style={[
          text.label,
          { color: tone, textTransform: "uppercase", letterSpacing: 1 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** A card's full-bleed footer CTA — an ink-filled row (leading icon + label +
 *  chevron in on-ink) that spans the card bottom. Shared by BudgetCard and
 *  NoBusinessCard so the primary action reads identically. Owns symmetric
 *  padding (12 v / cardPadding h); the card's overflow:hidden rounds its
 *  bottom corners. */
export function CardFooterCta({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        backgroundColor: color.ink,
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.md,
        minHeight: 48,
        justifyContent: "center",
      }}
    >
      {/* Press feedback rides on the inner content, not the Pressable — the
          full-bleed ink footer stays put while only the icon/label/chevron
          scale + dip, so the block never pulls away from the card edges. */}
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
        <View
          style={[
            { flexDirection: "row", alignItems: "center", gap: spacing.md },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <Ionicons name={icon} size={20} color={color.on.ink} />
          <Text style={[text.bodyMedium, { color: color.on.ink, flex: 1 }]}>
            {label}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={color.on.ink} />
        </View>
      )}
    </Pressable>
  );
}
