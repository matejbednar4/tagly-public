import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
} from "@tagly/client";
import {
  adminAssignPromotionalCredit,
  adminRefundCreditPurchase,
  adminGetStripeBalance,
} from "@tagly/sdk/v2/adminApp";
import type { AdminAdvertiser } from "@tagly/models/v2/adminApp";
import { PROMOTIONAL_CREDITS } from "@tagly/models/shared";
import { StatSection } from "@/components/statistics/StatKit";
import { Badge, type BadgeTone } from "@/components/entities/EntityRows";
import { formatUsd, formatInt, formatDateTime } from "@/utils/format";
import { openUrl, stripeDashboardUrl } from "@/utils/links";

/**
 * Advertiser billing actions for the admin advertiser detail screen: the
 * promotional-credit form (Budget section) and the credit-purchases list with
 * per-purchase refund (its own section). Both are SUPER-only money movements,
 * so every submit is confirm-guarded per the destructive-actions rule; the
 * server owns the real caps (unassigned platform balance, max refundable) and
 * callAuthed surfaces its rejections as alerts. `onDone` refetches the
 * advertiser so budget figures and purchase statuses stay current.
 */

type CreditPurchase = AdminAdvertiser["creditPurchases"][number];

/** `"12.34"` (optionally `$`/commas) → 1234 cents; null when not a valid amount. */
function parseUsdToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

const STATUS_TONES: Record<CreditPurchase["status"], BadgeTone> = {
  PENDING: "info",
  COMPLETED: "money",
  FAILED: "danger",
  CANCELED: "danger",
  REFUNDED: "ink",
  PARTIALLY_REFUNDED: "highlight",
};

function isRefundable(cp: CreditPurchase): boolean {
  return (
    cp.kind === "CREDIT_PURCHASE" &&
    (cp.status === "COMPLETED" || cp.status === "PARTIALLY_REFUNDED") &&
    cp.stripePaymentIntentId != null
  );
}

/** "Add promotional credit" button + amount/reason sheet (Budget section). */
export function PromoCreditButton({
  advertiser,
  onDone,
}: {
  advertiser: AdminAdvertiser;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // The platform's unassigned Stripe balance — the real cap on what can be
  // gifted. null = still loading (fail-open: the server re-checks inside the
  // assign transaction anyway).
  const [unassignedCents, setUnassignedCents] = useState<number | null>(null);

  // Refresh the unassigned balance every time the sheet opens, so the figure
  // is current when the admin decides an amount.
  useEffect(() => {
    if (!open) return;
    setUnassignedCents(null);
    void (async () => {
      const res = await callAuthed(
        router,
        (jwt) => adminGetStripeBalance({ jwt }),
        { suppressAlerts: true },
      );
      if (res.ok && res.data) setUnassignedCents(res.data.unassignedCents);
    })();
  }, [open, router]);

  const amountCents = parseUsdToCents(amount);
  const valid =
    amountCents != null &&
    amountCents <= PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS &&
    // Client-side mirror of the server's unassigned-balance gate (4953);
    // unknown balance fails open, the server stays authoritative.
    (unassignedCents == null || amountCents <= unassignedCents);

  const submit = () => {
    if (amountCents == null || !valid) return;
    customAlert(
      `Add ${formatUsd(amountCents)} promotional credit?`,
      `The amount comes out of the platform's unassigned balance and lands in ${advertiser.email}'s available budget. This cannot be undone from this screen.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add credit",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await callAuthed(router, (jwt) =>
                adminAssignPromotionalCredit({
                  jwt,
                  params: { uid: advertiser.uid },
                  body: {
                    amountCents,
                    ...(reason.trim() ? { reason: reason.trim() } : {}),
                  },
                }),
              );
              setBusy(false);
              if (res.ok && res.data) {
                setOpen(false);
                setAmount("");
                setReason("");
                onDone();
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={{ flexBasis: "100%" }}>
        <CustomButton
          type="secondary"
          label="Add promotional credit"
          icon="gift-outline"
          onPress={() => setOpen(true)}
        />
      </View>

      <BottomSheet open={open} onClose={busy ? undefined : () => setOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          {/* What's actually giftable right now — the unassigned slice of the
              platform's Stripe balance (green = money, per the color rules). */}
          <Text style={[text.body, { color: color.text.secondary }]}>
            Unassigned platform balance:{" "}
            <Text style={[text.bodyMedium, { color: color.success }]}>
              {unassignedCents == null ? "loading..." : formatUsd(unassignedCents)}
            </Text>
          </Text>
          <CustomTextInput
            heading="Amount (USD)"
            subheading={`Gifted from the platform's unassigned balance. Max ${formatUsd(PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS)}, one per advertiser per hour.`}
            placeholder="25.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            error={
              amount.trim() && !valid
                ? amountCents == null
                  ? "Enter a valid dollar amount"
                  : unassignedCents != null && amountCents > unassignedCents
                    ? `Only ${formatUsd(unassignedCents)} is unassigned`
                    : `Max is ${formatUsd(PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS)}`
                : undefined
            }
          />
          <CustomTextInput
            heading="Reason (optional)"
            subheading="Stored on the ledger event for the audit trail."
            placeholder="Why is this credit being granted?"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <CustomButton
            type="primary"
            label="Add promotional credit"
            disabled={!valid || busy}
            loading={busy}
            onPress={submit}
          />
        </View>
      </BottomSheet>
    </>
  );
}

/** Credit purchases section: one card per purchase, refund on refundable ones. */
export function CreditPurchasesSection({
  advertiser,
  onDone,
}: {
  advertiser: AdminAdvertiser;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const router = useRouter();

  // Refund flow: which purchase the amount sheet is open for.
  const [refunding, setRefunding] = useState<CreditPurchase | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const amountCents = parseUsdToCents(amount);
  const valid =
    refunding != null &&
    amountCents != null &&
    amountCents <= refunding.amountCents;

  const openRefund = (cp: CreditPurchase) => {
    setAmount((cp.amountCents / 100).toFixed(2));
    setReason("");
    setRefunding(cp);
  };

  const submit = () => {
    const cp = refunding;
    if (!cp || amountCents == null || !valid) return;
    customAlert(
      `Refund ${formatUsd(amountCents)}?`,
      `The money goes back to the card and comes out of ${advertiser.email}'s available budget. The purchase status updates once Stripe confirms.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Refund",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await callAuthed(router, (jwt) =>
                adminRefundCreditPurchase({
                  jwt,
                  params: { uid: cp.uid },
                  body: {
                    amountCents,
                    ...(reason.trim() ? { reason: reason.trim() } : {}),
                  },
                }),
              );
              setBusy(false);
              if (res.ok && res.data) {
                setRefunding(null);
                onDone();
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <StatSection
        title="Credit purchases"
        icon="card-outline"
        tint="money"
        summary={formatInt(advertiser.creditPurchases.length)}
      >
        {advertiser.creditPurchases.length === 0 ? (
          <Text style={[text.body, { color: color.text.secondary }]}>
            No credit purchases yet.
          </Text>
        ) : (
          advertiser.creditPurchases.map((cp) => (
            <View
              key={cp.uid}
              style={{
                flexBasis: "100%",
                backgroundColor: color.surface,
                borderRadius: radius.structure,
                boxShadow: shadow.card,
                padding: layout.cardPaddingCompact,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text style={[text.bodyMedium, { color: color.ink }]}>
                  {formatUsd(cp.amountCents)}
                </Text>
                <Text style={[text.micro, { color: color.text.tertiary }]}>
                  {formatDateTime(cp.createdAt)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                {cp.kind === "PAYG_CHARGE" ? (
                  <Badge tone="highlight" label="PAYG charge" />
                ) : null}
                <Badge tone={STATUS_TONES[cp.status]} label={cp.status} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {cp.stripePaymentIntentId ? (
                  <View style={{ flex: 1 }}>
                    <CustomButton
                      type="tertiary"
                      label="Open in Stripe"
                      icon="open-outline"
                      onPress={() =>
                        openUrl(
                          stripeDashboardUrl(
                            "payment_intent",
                            cp.stripePaymentIntentId as string,
                          ),
                        )
                      }
                    />
                  </View>
                ) : null}
                {isRefundable(cp) ? (
                  <View style={{ flex: 1 }}>
                    <CustomButton
                      type="destructive"
                      label="Refund"
                      disabled={busy}
                      onPress={() => openRefund(cp)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </StatSection>

      <BottomSheet
        open={refunding !== null}
        onClose={busy ? undefined : () => setRefunding(null)}
      >
        <View style={{ gap: spacing.lg }}>
          <CustomTextInput
            heading="Refund amount (USD)"
            subheading={
              refunding
                ? `Up to ${formatUsd(refunding.amountCents)} minus anything already refunded, capped at the advertiser's available budget.`
                : undefined
            }
            placeholder="25.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            error={
              amount.trim() && !valid
                ? amountCents == null
                  ? "Enter a valid dollar amount"
                  : `Max is ${formatUsd(refunding?.amountCents ?? 0)}`
                : undefined
            }
          />
          <CustomTextInput
            heading="Reason (optional)"
            subheading="Stored on the ledger event for the audit trail."
            placeholder="Why is this purchase being refunded?"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <CustomButton
            type="destructive"
            label="Refund"
            disabled={!valid || busy}
            loading={busy}
            onPress={submit}
          />
        </View>
      </BottomSheet>
    </>
  );
}
