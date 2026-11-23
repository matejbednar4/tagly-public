import Constants from "expo-constants";
import type { PaymentSheet } from "@stripe/stripe-react-native";

const { APP_ENV } = Constants.expoConfig?.extra as { APP_ENV: string };

/**
 * Shared wallet configs for every PaymentSheet (PAYG card-link + credit
 * purchase). Charges are always USD from the US platform account, regardless
 * of the advertiser's locale.
 *
 * Google Pay: `testEnv` maps non-production builds to Google's test
 * environment — no Google-side registration needed there; production
 * additionally requires approval in the Google Pay & Wallet Console before the
 * wallet button shows to real users. `currencyCode` is required in setup mode
 * (payment mode reads it off the PaymentIntent).
 *
 * Apple Pay: rides the merchant id configured in `app.config.ts`
 * (`STRIPE_MERCHANT_ID`, wired into the Stripe plugin entitlement and
 * `StripeProvider`). The merchant id must exist in the Apple Developer portal
 * and have a Stripe payment-processing certificate for live payments.
 */
export const GOOGLE_PAY: PaymentSheet.GooglePayParams = {
  merchantCountryCode: "US",
  currencyCode: "USD",
  testEnv: APP_ENV !== "production",
};

export const APPLE_PAY: PaymentSheet.ApplePayParams = {
  merchantCountryCode: "US",
};
