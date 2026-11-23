import { useRouter } from "expo-router";
import { useStripe, PaymentSheetError } from "@stripe/stripe-react-native";
import { callAuthed } from "@tagly/client";
import { getCreditPurchaseStatus } from "@tagly/sdk/v2/advertiserApp";
import { GOOGLE_PAY, APPLE_PAY } from "@/constants/stripeWallets";
import { pollUntil } from "@/utils/paymentVerification";
import { useTheme } from "@tagly/client";

/**
 * The credit-purchase payment flow, once — the twin of `useCardLink`.
 *
 * Two sheets buy credits with a PaymentIntent (`AddCreditsSheet` with a chosen
 * amount, `SettleBalanceSheet` with the server-computed debt) and both used to
 * carry their own copy of: open the PaymentSheet → tell a cancel from a real
 * failure → poll the purchase row until the webhook books it → map the status.
 * Two copies of a money flow means two places to get the cancel branch or the
 * "still PENDING" branch subtly wrong.
 *
 * What stays at the call site is only what genuinely differs: creating the
 * intent (different endpoints, different error codes) and the words.
 *
 * **PaymentSheet success is never authoritative** — this hook only reports
 * `completed` once the backend says the purchase row left PENDING, which is
 * the whole reason it polls.
 */
export type CreditPurchaseIntent = {
  creditPurchaseUid: string;
  paymentIntentClientSecret: string;
  customerId: string;
  ephemeralKeySecret: string;
};

export type PurchaseOutcome =
  /** Booked — the credits are real. */
  | "completed"
  /** The payment was declined/failed. */
  | "failed"
  /** The advertiser backed out. Not an error; never alert. */
  | "cancelled"
  /** Setting up or presenting the sheet failed. */
  | "error"
  /** Poll budget ran out with the row still PENDING — claim nothing. */
  | "unverified";

export function useCreditPurchase() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const runPayment = async ({
    intent,
    onVerifying,
  }: {
    intent: CreditPurchaseIntent;
    /** Fires once the PaymentSheet closes successfully, so the caller can flip
     *  into its non-dismissable verifying state before polling starts. */
    onVerifying: () => void;
  }): Promise<{ outcome: PurchaseOutcome; message?: string }> => {
    const init = await initPaymentSheet({
      merchantDisplayName: "Tagly",
      customerId: intent.customerId,
      customerEphemeralKeySecret: intent.ephemeralKeySecret,
      paymentIntentClientSecret: intent.paymentIntentClientSecret,
      googlePay: GOOGLE_PAY,
      applePay: APPLE_PAY,
    });
    if (init.error) return { outcome: "error" };

    const result = await presentPaymentSheet();
    if (result.error) {
      // Cancel is a normal action — the caller returns to its form with state
      // intact, and the abandoned PENDING purchase is expired by the reconcile
      // machinery.
      if (result.error.code === PaymentSheetError.Canceled) {
        return { outcome: "cancelled" };
      }
      return { outcome: "error", message: result.error.localizedMessage };
    }

    onVerifying();
    const status = await pollUntil(async () => {
      const check = await callAuthed(
        router,
        (jwt) =>
          getCreditPurchaseStatus({
            jwt,
            params: { uid: intent.creditPurchaseUid },
          }),
        { suppressAlerts: true },
      );
      // A transport error counts as "no answer yet" and just burns an attempt.
      if (!check.ok || !check.data) return null;
      return check.data.status === "PENDING" ? null : check.data.status;
    });

    if (status === "COMPLETED") return { outcome: "completed" };
    if (status === "FAILED") return { outcome: "failed" };
    return { outcome: "unverified" };
  };

  return { runPayment };
}
