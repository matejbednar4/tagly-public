import { useRouter } from "expo-router";
import { useStripe, PaymentSheetError } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { callAuthed } from "@tagly/client";
import {
  setupSavedCard,
  reconcileSavedCard,
} from "@tagly/sdk/v2/advertiserApp";
import { GOOGLE_PAY, APPLE_PAY } from "@/constants/stripeWallets";
import { pollUntil } from "@/utils/paymentVerification";
import { MONTHLY_BUDGET_STATE_QUERY_KEY } from "./useMonthlyBudgetState";
import { PAYG_STATE_QUERY_KEY } from "./usePaygState";
import { SAVED_CARD_QUERY_KEY } from "./useSavedCard";

/**
 * The card-link flow, once. Three sheets need to put a card on file (adding
 * one outright, turning on a rule that has none, replacing a failing one) and
 * every one of them ran its own copy of: stamp the mandate → PaymentSheet →
 * poll the idempotent reconcile → invalidate the shared queries. Duplicating
 * that meant three chances to forget an invalidation and leave one surface
 * showing a card that no longer exists.
 *
 * It is deliberately **copy-free**: it reports an outcome and the caller
 * supplies the words, because the same mechanical step means different things
 * in different sheets ("adding your card" vs "confirming your new card").
 *
 * Outcomes:
 * - `linked` — the card is ours (reconcile confirmed, or the webhook won the race).
 * - `cancelled` — the advertiser backed out of the PaymentSheet. Not an error;
 *   never alert on it.
 * - `failed` — setup or the sheet errored. The caller alerts and restores its form.
 * - `unverified` — the poll budget ran out. The link may still land, so the
 *   caller must NOT claim success and must NOT claim failure.
 *
 * `onVerifying` fires once the PaymentSheet closes successfully, so the caller
 * can flip into its non-dismissable verifying state before the polling starts.
 */
export type CardLinkOutcome = "linked" | "cancelled" | "failed" | "unverified";

export function useCardLink() {
  const router = useRouter();
  const qc = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const linkCard = async ({
    onVerifying,
  }: {
    onVerifying: () => void;
  }): Promise<CardLinkOutcome> => {
    // Stamps the off-session consent server-side before the sheet opens. The
    // link is feature-agnostic (`card_setup`): it puts a card on file and
    // enables nothing — each rule is turned on by its own endpoint.
    const setup = await callAuthed(router, (jwt) =>
      setupSavedCard({ jwt, body: { chargeAuthorized: true } }),
    );
    if (!setup.ok || !setup.data) return "failed";

    const {
      setupIntentClientSecret,
      setupIntentId,
      customerId,
      ephemeralKeySecret,
    } = setup.data;

    const init = await initPaymentSheet({
      merchantDisplayName: "Tagly",
      customerId,
      customerEphemeralKeySecret: ephemeralKeySecret,
      setupIntentClientSecret,
      googlePay: GOOGLE_PAY,
      applePay: APPLE_PAY,
    });
    if (init.error) return "failed";

    const result = await presentPaymentSheet();
    if (result.error) {
      return result.error.code === PaymentSheetError.Canceled
        ? "cancelled"
        : "failed";
    }

    // The sheet said yes, but the card is only ours once it's saved — poll the
    // idempotent reconcile (`linked: false` = the SetupIntent is still
    // processing; transport errors just burn an attempt).
    onVerifying();
    const linked = await pollUntil(async () => {
      const check = await callAuthed(
        router,
        (jwt) => reconcileSavedCard({ jwt, body: { setupIntentId } }),
        { suppressAlerts: true },
      );
      if (!check.ok || !check.data) return null;
      return check.data.linked ? true : null;
    });

    // Either way the server may have moved: mark every card observer stale in
    // one place, so no caller can forget one. `hasCard` rides all three
    // responses, which is why a link invalidates the rule queries too.
    void qc.invalidateQueries({ queryKey: SAVED_CARD_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PAYG_STATE_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY });

    return linked ? "linked" : "unverified";
  };

  return { linkCard };
}
