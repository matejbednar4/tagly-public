import { Linking } from "react-native";
import Constants from "expo-constants";

/**
 * Click-through link builders for the admin detail screens. Turns the reference
 * data an admin sees (Instagram handles, emails, Stripe object ids, coordinates)
 * into openable URLs. `openUrl` is the single opener — fire-and-forget, swallows
 * the rejection if no app can handle the scheme.
 */

/** Open an external URL; best-effort (a missing handler app must not throw). */
export function openUrl(url: string): void {
  void Linking.openURL(url).catch(() => {});
}

/** Instagram profile from a handle (leading @ optional). */
export function instagramProfileUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@+/, "")}`;
}

/** `mailto:` for an email address. */
export function emailUrl(email: string): string {
  return `mailto:${email}`;
}

/** `tel:` for a phone number (tap-to-call). */
export function phoneUrl(phone: string): string {
  return `tel:${phone}`;
}

/** Google Maps search pin for a coordinate. */
export function mapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

// Non-production admin builds point at the Stripe test-mode dashboard (staging +
// dev use Stripe test keys); production points at live. The mode prefix is the
// difference between a working deep link and a 404 on the wrong dataset.
const APP_ENV = (Constants.expoConfig?.extra as { APP_ENV?: string } | undefined)
  ?.APP_ENV;
const STRIPE_BASE =
  APP_ENV === "production"
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";

/** The Stripe object types the admin DTOs expose ids for. */
export type StripeObject =
  | "payment_intent"
  | "charge"
  | "customer"
  | "connect_account"
  | "transfer"
  | "payout"
  | "checkout_session";

const STRIPE_PATHS: Record<StripeObject, string> = {
  payment_intent: "payments",
  charge: "payments",
  customer: "customers",
  connect_account: "connect/accounts",
  transfer: "connect/transfers",
  payout: "payouts",
  checkout_session: "checkout/sessions",
};

/** Stripe dashboard deep link for one object, mode-aware (test vs live). */
export function stripeDashboardUrl(kind: StripeObject, id: string): string {
  return `${STRIPE_BASE}/${STRIPE_PATHS[kind]}/${id}`;
}
