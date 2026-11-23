import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useNavigation, useRouter } from "expo-router";
import {
  BottomActionBar,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  pressFeedbackStyle,
  PressableText,
  queueStoreReview,
  useFormatBudget,
  useTheme,
} from "@tagly/client";
import { createWithdrawal } from "@tagly/sdk/v2/customerApp";
import { WITHDRAWALS } from "@tagly/models/shared";
import { useCustomer } from "@/contexts/Customer";
import WithdrawalsInfoSheet from "@/components/withdraw/WithdrawalsInfoSheet";

/**
 * Withdrawal form.
 *
 * Shown on `/withdraw` once Stripe Connect payouts are enabled. Lets the customer
 * enter an amount (bounded by their balance + the WITHDRAWALS min) and cash out
 * via `createWithdrawal` (a standard payout to their bank).
 *
 * On success it queues a store-review prompt and routes to the transactions feed
 * (where the new withdrawal shows as "on its way" and the queued review is
 * consumed). Money follows the app convention: USD primary + `≈ Kč` secondary for
 * CZ (`useFormatBudget`); interpolated amounts stay USD.
 */
export default function WithdrawForm({
  balanceCents,
}: {
  balanceCents: number;
}) {
  const { t } = useTranslation("withdrawForm");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius } = theme;
  const formatBudget = useFormatBudget();
  const router = useRouter();
  const navigation = useNavigation();
  const { reloadCustomer } = useCustomer();

  const [amount, setAmount] = useState("");
  const [ctaBarHeight, setCtaBarHeight] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<TextInput>(null);

  // Focus the amount only after the screen's push transition finishes. Focusing
  // mid-transition makes iOS slide the keyboard in from the RIGHT (riding the
  // horizontal push) instead of up from the bottom — the reason the OTP step waits
  // for `transitionEnd`. A fallback timer (> the push duration) covers the rare
  // case where the form mounts after the transition already ended (slow
  // connect-status); focusing twice is a harmless no-op.
  useEffect(() => {
    let done = false;
    const focus = () => {
      if (done) return;
      done = true;
      amountRef.current?.focus();
    };
    // expo-router's generic navigation type omits `transitionEnd` — cast to it.
    const nav = navigation as unknown as {
      addListener: (
        type: "transitionEnd",
        cb: (e: { data?: { closing?: boolean } }) => void,
      ) => () => void;
    };
    const unsubscribe = nav.addListener("transitionEnd", (e) => {
      if (!e.data?.closing) focus();
    });
    const timer = setTimeout(focus, 600);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [navigation]);

  // Parse the typed dollars → integer cents (tolerate a comma decimal).
  const parsed = parseFloat(amount.replace(",", "."));
  const amountCents = Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;

  const overBalance = amountCents > balanceCents;
  const belowMin =
    amount.length > 0 && amountCents < WITHDRAWALS.MIN_AMOUNT_CENTS;
  const valid =
    amountCents >= WITHDRAWALS.MIN_AMOUNT_CENTS && amountCents <= balanceCents;

  const minLabel = formatBudget(WITHDRAWALS.MIN_AMOUNT_CENTS, {
    forcedCurrency: "USD",
  });

  const amountError = overBalance
    ? t("errorTooMuch")
    : belowMin
      ? t("errorMin", { min: minLabel })
      : undefined;

  const balancePrimary = formatBudget(balanceCents, { forcedCurrency: "USD" });

  const fillMax = () => setAmount((balanceCents / 100).toFixed(2));

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);

    const result = await callAuthed(
      router,
      (jwt) =>
        createWithdrawal({
          jwt,
          body: { amountCents },
        }),
      { handleSpecificErrorManually: true },
    );

    if (!result.ok) {
      setSubmitting(false);
      const code = result.error?.error.code;
      if (code === 1615) {
        // Insufficient funds server-side — the cached balance was stale (spend
        // settled elsewhere). Nothing was charged; refresh so the cap is real.
        customAlert(t("errorInsufficientTitle"), t("errorInsufficientBody"));
        void reloadCustomer();
      } else if (code === 1712 || code === 1716) {
        // Connect account gone / payouts turned off since this form rendered
        // (Stripe flipped requirements). Send them back to the payout status
        // screen, which re-syncs and explains what Stripe needs.
        customAlert(t("errorPayoutsOffTitle"), t("errorPayoutsOffBody"));
        router.back();
      } else if (code === 1713) {
        // The transfer was definitively rejected and the balance restored in
        // full — say so, "something went wrong" alone reads like lost money.
        customAlert(t("errorTransferFailedTitle"), t("errorTransferFailedBody"));
      } else if (typeof code === "number" && code >= 1000) {
        customAlert(t("errorGenericTitle"), t("errorGenericBody"));
      }
      return;
    }

    // Refresh the cached balance (the withdrawal debited it) so the account hub /
    // a return to this form isn't stale. Fire-and-forget.
    void reloadCustomer();

    // Starting a withdrawal is a positive moment — queue a store-review prompt for
    // the transactions screen to consume. Best-effort; never blocks navigation.
    void queueStoreReview();

    // Land on the money history: the new withdrawal shows there as "on its way",
    // and the queued review is consumed. Replace so "back" returns to the account
    // hub, not this now-stale form. Keep the button loading through navigation.
    router.replace("/transactions");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.xl,
          paddingBottom: ctaBarHeight + spacing.lg,
          gap: spacing.xl,
        }}
      >
        {/* How withdrawals work — an info note at the top; opens the explainer. */}
        <Pressable
          onPress={() => setInfoOpen(true)}
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
              gap: spacing.md,
              backgroundColor: color.brand,
              borderRadius: radius.structure,
              padding: layout.cardPadding,
            },
            pressFeedbackStyle({ pressed, hovered }),
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.bodyMedium, { color: color.on.brand }]}>
              {t("infoCta")}
            </Text>
            <Text style={[text.caption, { color: color.on.brand }]}>
              {t("infoSubtitle")}
            </Text>
          </View>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={color.on.brand}
          />
        </Pressable>

        {/* Amount — a standard text field, with the balance as a helper line. */}
        <View style={{ gap: spacing.sm }}>
          <CustomTextInput
            ref={amountRef}
            heading={t("amountLabel")}
            headingRight={
              <PressableText onPress={fillMax}>
                {t("withdrawAll")}
              </PressableText>
            }
            prefix="$"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            error={amountError}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {t("availableAmount", { amount: balancePrimary })}
            </Text>
          </View>
        </View>

      </ScrollView>

      <BottomActionBar onHeightChange={setCtaBarHeight}>
        <CustomButton
          type="primary"
          label={
            valid
              ? t("withdrawAmount", {
                  amount: formatBudget(amountCents, { forcedCurrency: "USD" }),
                })
              : t("withdraw")
          }
          icon="cash-outline"
          loading={submitting}
          disabled={!valid || submitting}
          onPress={onSubmit}
        />
      </BottomActionBar>

      <WithdrawalsInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}
