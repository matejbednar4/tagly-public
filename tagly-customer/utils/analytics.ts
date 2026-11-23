import { useEffect, useMemo, useRef } from "react";
import { useSegments } from "expo-router";
import { usePostHog } from "posthog-react-native";

/**
 * Typed analytics event catalog + a thin PostHog wrapper.
 *
 * One canonical place for every product event we track, so names stay consistent
 * and greppable instead of scattered string literals. Add an event by giving it a
 * key in `AnalyticsEventMap` (the value is its property payload — use
 * `EmptyPayload` for events with no properties); `track()` is then type-checked
 * against the catalog (unknown names and wrong/missing payloads fail to compile).
 *
 * Analytics are **anonymous** — PostHog is configured `personProfiles:
 * "identified_only"` and we never call `identify()` (see the provider config in
 * `app/_layout.tsx`). Do NOT put PII (email, name, IG handle, tokens) into any
 * payload here; keep payloads to enums, booleans, counts, and prefixed UIDs.
 *
 * App-local on purpose: PostHog only runs in tagly-customer today. If the
 * advertiser app ever adds analytics, promote this to `tagly-shared/client`.
 */

/** Payload for events that carry no properties. */
type EmptyPayload = Record<string, never>;

/** Whether an auth action logged the user straight in or created a pending registration. */
type AuthOutcome = "login" | "registration";

/**
 * Which surface a share creation originated from. `opportunity_sheet` covers both
 * the sheet's one-tap create AND an `inBusiness` handoff into the picker (the
 * source is threaded through the create flow), so it means "started from the
 * app-open geo-nudge", not just the one-tap variant. `picker` is a direct entry
 * (business card, map, detail).
 */
export type ShareCreateSource = "picker" | "opportunity_sheet";

export interface AnalyticsEventMap {
  // ── Onboarding funnel ──────────────────────────────────────────────────────
  // Naming: `onboarding_<step>_<pastTenseAction>`. `path_` marks the two parallel
  // identity paths (email vs oauth) that converge on the same funnel; the linear
  // shared steps (push/consent/profile/complete) omit it.
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
  /** Notifications step resolved (permission granted or skipped). */
  onboarding_push_resolved: { granted: boolean };
  /** EU marketing-consent step submitted (opted in or out). */
  onboarding_consent_submitted: { enabled: boolean };
  /** Profile step (name/gender/interests) saved. */
  onboarding_profile_submitted: EmptyPayload;
  /** Registration completed — the final onboarding step. */
  onboarding_completed: { connectedInstagram: boolean; isNewAccount: boolean };
  /** Instagram OAuth prompt cancelled/dismissed during the connect step. */
  onboarding_instagram_cancelled: { outcome: "cancel" | "dismiss" };
  /** Instagram OAuth returned an error during the connect step. */
  onboarding_instagram_error: {
    instagramError?: string | null;
    instagramErrorReason?: string | null;
  };

  // ── Share-creation (monetization) funnel ────────────────────────────────────
  // Same shape as onboarding: `share_create_<pastTenseAction>`. Every event carries
  // `source` (the surface the creation started from — threaded through the picker
  // flow via a route param), so the whole funnel is attributable end-to-end.
  // `share_create_succeeded` is the single canonical "a share was created" event
  // across both surfaces (sum it for totals; break down by `source`).
  /** Story picker opened for a business — picker-flow funnel start. */
  share_create_started: { businessUid: string; source: ShareCreateSource };
  /** Confirm/consent step shown for a picked story (picker flow only). */
  share_create_confirm_viewed: { businessUid: string; source: ShareCreateSource };
  /** Create-share request being sent. */
  share_create_submitted: { businessUid: string; source: ShareCreateSource };
  /** Share created (held for admin review). */
  share_create_succeeded: {
    businessUid: string;
    shareUid: string;
    source: ShareCreateSource;
  };
  /** Create-share request failed. `errorCode` is the domain code, or 0 for a
   *  transport/handled-centrally failure with no structured code. */
  share_create_failed: {
    businessUid: string;
    errorCode: number;
    source: ShareCreateSource;
  };
  /** The app-open geo-nudge sheet displayed a real share opportunity (top of the
   *  opportunity-sheet funnel; `inBusinessWithStory` = the one-tap create variant). */
  share_opportunity_shown: {
    businessUid: string;
    scenario: "inBusiness" | "inBusinessWithStory";
  };

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
 * no payload as `track("onboarding_signin_viewed")`; events with a payload require
 * it: `track("share_created", { businessUid, shareUid })`.
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
 * **route pattern** from `useSegments()` (`["(app)", "shares", "[uid]"]`) rather
 * than the resolved URL (`usePathname()` would resolve `[uid]` to the real id), so
 * dynamic ids never leak into analytics and screens aggregate by route instead of
 * fragmenting one-per-record. Group segments (`(app)`, `(tabs)`) are stripped for
 * readable names (`/shares/[uid]`, `/map`).
 *
 * Call once, high in the tree — inside the PostHog provider AND the router (see
 * `RootNavigator` in `app/_layout.tsx`). This is done manually because PostHog's
 * `captureScreens` autocapture can't reach expo-router's NavigationContainer, so
 * it's disabled in the provider config.
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
