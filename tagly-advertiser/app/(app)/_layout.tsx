import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  AcceptLatestPrivacyPolicyModal,
  AcceptLatestTosModal,
  callAuthed,
  DrawerProvider,
  ExchangeRateProvider,
  getDeviceId,
  getPushPermissionGranted,
  requestAndGetExpoToken,
  useStaleResume,
  useTheme,
} from "@tagly/client";
import { onAppOpen } from "@tagly/sdk/v2/advertiserApp";
import AdvertiserDrawer from "@/components/drawer/AdvertiserDrawer";
import {
  AdvertiserProvider,
  useAdvertiser,
} from "@/contexts/advertiser/AdvertiserContext";

/**
 * How long the app may sit backgrounded (suspended, not killed) before a reopen
 * is treated as a fresh start — nav reset to home + a re-run cold-start. Tune
 * here. Twin of the customer layout's threshold.
 */
const STALE_RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Authed app shell (gatekeeper). Mounts the advertiser data context
 * (`GET /v2/advertisers/me`), then gates the authed Stack:
 *
 *   - payment setup pending (unfunded + not dismissed on this device — see
 *     `AdvertiserContext`) → the forward-only **setup phase** (`setup/payment`,
 *     later `setup/business-page`) — visually a continuation of onboarding,
 *     but post-sign-in so it's kill-and-resume safe.
 *   - otherwise → the `(tabs)` group (Home · Wallet · Account).
 *
 * The gate is **fail-open**: if /me can't be fetched (transient failure) the
 * user lands in the tabs rather than being blocked — the Wallet tab is the
 * permanent second chance for payment setup.
 *
 * `DrawerProvider` wraps everything so the `TopMenu` menu button (rendered by
 * each tab root) can toggle the drawer, and `AdvertiserDrawer` is a sibling of
 * the Stack so it overlays every screen.
 *
 * `ExchangeRateProvider` (fed the advertiser's locale) sits under
 * `AdvertiserProvider` so `useFormatBudget()` can render the ≈ CZK courtesy
 * line for CZ advertisers — it only fetches the rate for CZ, no-ops otherwise.
 *
 * Still deferred to the /v2 advertiser backend surface (see v2.0.0.md §3A):
 * the real drawer content, and the pushed detail screens (shares,
 * business-pages, settings) that will sit here as siblings of `(tabs)`.
 */
export default function AppLayout() {
  return (
    <AdvertiserProvider>
      <DrawerProvider>
        <AppShell />
      </DrawerProvider>
    </AdvertiserProvider>
  );
}

/** Reads the advertiser's locale (now under `AdvertiserProvider`) to drive the
 *  exchange-rate context, then renders the gated stack + drawer. */
function AppShell() {
  const router = useRouter();
  const { advertiser, setAdvertiser, refresh } = useAdvertiser();

  // The two legal gates are read straight off the cached advertiser; accepting
  // patches the flag false (in `onFinished`) so the gate closes without a
  // refetch — a later `refresh` returns false too (the backend stamped the
  // agreed-at), so it never flips back. Twin of the customer layout.
  const shouldAcceptTos = advertiser?.shouldAgreeWithLatestTos === true;
  const shouldAcceptPrivacy =
    advertiser?.shouldAgreeWithLatestPrivacyPolicy === true;

  // The single modal that SHOULD be showing right now, by priority (ToS before
  // Privacy). Null = none.
  const desiredModal: "tos" | "privacy" | null = shouldAcceptTos
    ? "tos"
    : shouldAcceptPrivacy
      ? "privacy"
      : null;

  // The modal actually mounted. We stagger transitions: closing one before
  // opening the next so their backdrops can't overlap and swallow touches
  // (matches the customer layout's modal cycle).
  const [activeModal, setActiveModal] = useState<"tos" | "privacy" | null>(
    null,
  );
  useEffect(() => {
    if (activeModal === desiredModal) return;
    if (activeModal !== null) {
      setActiveModal(null); // close current; this effect re-runs once it's null
      return;
    }
    if (desiredModal === null) return;
    const timer = setTimeout(() => setActiveModal(desiredModal), 300);
    return () => clearTimeout(timer);
  }, [activeModal, desiredModal]);

  /**
   * Fire-and-forget app-open side effects (`POST /me/on-app-open`): ensure
   * notification defaults + register this device's push token (with platform,
   * deviceId + timezone) + report the OS notification-permission status so the
   * backend can disable this device's tokens when permission is off (a revoked
   * permission does NOT invalidate the Expo token) — the only post-onboarding
   * token write, so it covers Expo token rotation and permission granted later.
   * Mirrors the customer app. Never blocks app init.
   *
   * ⚠️ **Prompts on the first authed mount — DELIBERATE (Matej, 2026-08-09).**
   * `requestAndGetExpoToken` (not the read-only twin) is used on purpose: iOS
   * grants one permission dialog per install, and we deliberately spend it here,
   * right after sign-in, because acceptance is materially higher there than at
   * the onboarding primer. Accepted consequences, both understood and signed off:
   *   - it fires even for a user who just tapped "Maybe later" on the primer;
   *   - it consumes the one-shot, so Settings → Notifications → Push can no
   *     longer raise the dialog itself and only deep-links to OS settings.
   * Do NOT "fix" this back to `getExpoTokenIfGranted` — the earlier report that
   * it was a bug (A-NEW7) was closed as intended behaviour. Subsequent calls are
   * harmless: once the user has answered, the OS resolves them without a dialog.
   */
  const runOnAppOpen = async () => {
    try {
      const pushToken =
        (await requestAndGetExpoToken().catch(() => null)) ?? undefined;
      // Read AFTER the token request so a just-granted permission reports
      // true. deviceId lets the backend scope a permission-off disable to
      // this device (with permission off there is no token to identify it).
      const [pushPermissionGranted, deviceId] = await Promise.all([
        getPushPermissionGranted().catch(() => undefined),
        getDeviceId(),
      ]);
      await callAuthed(
        router,
        (jwt) =>
          onAppOpen({
            jwt,
            body: {
              pushToken,
              platform: Platform.OS === "ios" ? "ios" : "android",
              deviceId: deviceId ?? undefined,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              pushPermissionGranted,
            },
          }),
        { suppressAlerts: true },
      );
    } catch {
      // Non-critical — must never block app init.
    }
  };

  useEffect(() => {
    void runOnAppOpen();
    // Once per authed session mount, like the customer's onInitialLoad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reopening after a long absence (backgrounded, not killed) should feel like a
  // fresh launch, since iOS/Android otherwise restore the exact prior state.
  // Reset navigation to the home tab and re-run the cold-start work: the /me
  // refresh (silent, fail-open — the cached advertiser stays rendered while it
  // resolves) + the fire-and-forget on-app-open side effects. If the account is
  // mid-setup the tabs stay guarded off, so the replace lands back in `setup`.
  // Twin of the customer layout's stale-resume reset.
  useStaleResume(
    STALE_RESUME_THRESHOLD_MS,
    useCallback(() => {
      if (router.canDismiss()) router.dismissAll();
      router.replace("/home");
      void refresh();
      void runOnAppOpen();
      // runOnAppOpen is recreated per render but only reads stable refs/imports.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, refresh]),
  );

  return (
    <ExchangeRateProvider locale={advertiser?.locale}>
      <View style={{ flex: 1 }}>
        <GatedStack />
        <AdvertiserDrawer />

        <AcceptLatestTosModal
          open={activeModal === "tos"}
          onFinished={() => {
            setAdvertiser((prev) =>
              prev ? { ...prev, shouldAgreeWithLatestTos: false } : prev,
            );
            setActiveModal(null);
          }}
        />

        <AcceptLatestPrivacyPolicyModal
          open={activeModal === "privacy"}
          onFinished={() => {
            setAdvertiser((prev) =>
              prev
                ? { ...prev, shouldAgreeWithLatestPrivacyPolicy: false }
                : prev,
            );
            setActiveModal(null);
          }}
        />
      </View>
    </ExchangeRateProvider>
  );
}

function GatedStack() {
  const { theme } = useTheme();
  const { ready, paymentSetupPending, businessSetupPending } = useAdvertiser();

  // Hold until /me resolves so we never flash the tabs before routing a fresh
  // account into setup (mirrors the root guard holding on the session).
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="small" color={theme.color.ink} />
      </View>
    );
  }

  // Which setup step to show is decided inside setup/_layout; this gate only
  // decides setup-vs-tabs.
  const setupPending = paymentSetupPending || businessSetupPending;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!setupPending}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={setupPending}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
  );
}
