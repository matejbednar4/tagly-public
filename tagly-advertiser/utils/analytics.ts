import { useEffect, useMemo, useRef } from "react";
import { useSegments } from "expo-router";
import { usePostHog } from "posthog-react-native";

/**
 * Typed analytics event catalog + a thin PostHog wrapper (advertiser app).
 *
 * One canonical place for every product event we track, so names stay consistent
 * and greppable instead of scattered string literals. Add an event by giving it a
 * key in `AnalyticsEventMap` (the value is its property payload — use
 * `EmptyPayload` for events with no properties); `track()` is then type-checked
 * against the catalog.
 *
 * Analytics are **anonymous** — PostHog is configured `personProfiles:
 * "identified_only"` and we never call `identify()` (see the provider config in
 * `app/_layout.tsx`). Do NOT put PII (email, name, tokens) into any payload here;
 * keep payloads to enums, booleans, counts, and prefixed UIDs.
 *
 * App-local, but the SAME PostHog project as the customer app — events are kept
 * apart by the global `app: "advertiser"` super-property (stamped in the provider
 * options), never by prefixing event names. The onboarding funnel intentionally
 * mirrors the customer's event names so the two apps' funnels compare directly.
 */

/** Payload for events that carry no properties. */
type EmptyPayload = Record<string, never>;

/** Whether an auth action logged the user straight in or created a pending registration. */
type AuthOutcome = "login" | "registration";

/** Which host mounted a billing sheet — the breakdown dimension on every money
 *  event (the sheets are reused verbatim across all three surfaces). */
export type BillingSurface = "setup" | "home" | "wallet";

export interface AnalyticsEventMap {
  // ── Onboarding funnel ──────────────────────────────────────────────────────
  // Naming mirrors the customer app: `onboarding_<step>_<pastTenseAction>`. Only
  // the top-of-funnel event is wired today (the rest land with the /v2 advertiser
  // auth slice), but the shape is declared so instrumentation is drop-in.
  /** Sign-in screen shown — funnel start (the denominator). */
  onboarding_started: EmptyPayload;
  /** Email path — email entered and an OTP was successfully requested. */
  onboarding_path_email_submitted: EmptyPayload;
  /** Email path — OTP verified; `outcome` = returning login vs new registration. */
  onboarding_path_email_verified: { outcome: AuthOutcome };
  /** OAuth path — Google/Apple sign-in completed; `outcome` = login vs registration. */
  onboarding_path_oauth_submitted: {
    provider: "google" | "apple";
    outcome: AuthOutcome;
  };
  /** Notifications step resolved; `granted` = OS push permission was granted. */
  onboarding_push_resolved: { granted: boolean };
  /** Marketing-consent step submitted; `enabled` = opted in. */
  onboarding_consent_submitted: { enabled: boolean };
  /** Registration completed — the final onboarding step. */
  onboarding_completed: { isNewAccount: boolean };

  // ── Setup phase — post-sign-in payment + business-page steps ───────────────
  // The skippable funding + business-page steps that follow `finishing`
  // (v2.0.0.md §3A; flow in the payment-step design doc). Funding *outcomes*
  // (purchase/link) are NOT setup events — they're the surface-neutral billing
  // events below, fired inside the sheets with `surface: "setup"`.
  /** Payment step (the prepay vs pay-per-share fork) shown — setup-funnel start. */
  setup_payment_viewed: EmptyPayload;
  /** A funding method's sheet was opened from the setup step. Only the two
   *  fork options exist there: the monthly top-up is offered as a row once the
   *  account is funded, never as a third choice at first decision. */
  setup_payment_mode_selected: { mode: "payg" | "credits" };
  /** Payment step skipped without funding. */
  setup_payment_skipped: EmptyPayload;
  /** Business-page (local subaccount) step shown. */
  setup_business_page_viewed: EmptyPayload;
  /** Business page created during setup. */
  setup_business_page_created: EmptyPayload;
  /** Business-page step skipped. */
  setup_business_page_skipped: EmptyPayload;

  // ── Billing (money) events ──────────────────────────────────────────────────
  // Fired INSIDE the billing sheets (`AddCreditsSheet` / `MonthlyTopUpSheet` /
  // `PaygSheet` / `CardSheet` / `SettleBalanceSheet`) after the backend
  // confirmed the money truth — never in a host screen, so no surface can
  // forget them. Every event carries `surface`
  // (which host mounted the sheet), making each one both a total ("all credit
  // purchases") and a breakdown ("first-time setup vs wallet top-up").
  /** Credits purchased and booked (webhook-verified), any surface. */
  credits_purchased: { amountCents: number; surface: BillingSurface };
  /** PAYG card linked (reconcile-verified). `action` = fresh link vs replacing
   *  an existing card (an update is not new funding). */
  payg_card_linked: { surface: BillingSurface; action: "link" | "update" };
  /** PAYG card disconnected — PAYG off until relinked (churn signal). */
  payg_card_unlinked: { surface: BillingSurface };
  /** PAYG turned on with the card already on file (no new link). */
  payg_turned_on: { surface: BillingSurface };
  /** PAYG turned off while keeping the saved card (the monthly budget keeps
   *  running) — softer than `payg_card_unlinked`. */
  payg_turned_off: { surface: BillingSurface };
  /** Monthly top-up turned on. No `outcome`: activation never charges (the
   *  first run is the next 1st), so there is nothing to report but the fact.
   *  `linkedCard` = the flow also linked a card first. */
  monthly_budget_enabled: {
    targetCents: number;
    surface: BillingSurface;
    linkedCard: boolean;
  };
  /** An active monthly budget's target was changed. */
  monthly_budget_updated: { targetCents: number; surface: BillingSurface };
  /** Monthly budget turned off. `removedCard` = the advertiser also unlinked
   *  the card (which stops PAYG too). */
  monthly_budget_disabled: { surface: BillingSurface; removedCard: boolean };
  /** Negative balance settled (server-computed debt paid, webhook-verified). */
  balance_settled: { amountCents: number; surface: BillingSurface };

  // ── Push notifications ──────────────────────────────────────────────────────
  /** A push notification was tapped — the only observable push "open" (the OS
   *  never reports tray views). `slug` is the backend catalog event slug from the
   *  push payload (promo + transactional alike), null when absent. Pairs with the
   *  backend's `promo_notification_sent` for per-step open rates. */
  push_opened: { slug: string | null };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;

/**
 * Returns a typed `track()` bound to the mounted PostHog client. Call events with
 * no payload as `track("onboarding_started")`; events with a payload require it.
 */
export function useAnalytics() {
  const posthog = usePostHog();
  return useMemo(
    () => ({
      track<E extends AnalyticsEvent>(
        event: E,
        ...rest: AnalyticsEventMap[E] extends EmptyPayload
          ? []
          : [props: AnalyticsEventMap[E]]
      ): void {
        posthog.capture(
          event,
          rest[0] as Parameters<typeof posthog.capture>[1],
        );
      },
    }),
    [posthog],
  );
}

/**
 * Fires a PostHog `$screen` event on every route change. Uses the expo-router
 * **route pattern** from `useSegments()` rather than the resolved URL, so dynamic
 * ids never leak into analytics and screens aggregate by route. Group segments
 * (`(app)`, `(onboarding)`) are stripped for readable names.
 *
 * Call once, high in the tree — inside the PostHog provider AND the router (see
 * `RootNavigator` in `app/_layout.tsx`). This is done manually because PostHog's
 * `captureScreens` autocapture can't reach expo-router's NavigationContainer.
 */
export function useScreenTracking(): void {
  const posthog = usePostHog();
  const segments = useSegments();
  const lastScreen = useRef<string | null>(null);

  const screenName = useMemo(() => {
    const parts = segments.filter((s) => !s.startsWith("("));
    return parts.length ? `/${parts.join("/")}` : null;
  }, [segments]);

  useEffect(() => {
    if (!screenName || screenName === lastScreen.current) return;
    lastScreen.current = screenName;
    posthog.screen(screenName);
  }, [screenName, posthog]);
}
