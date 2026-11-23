import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  AcceptLatestPrivacyPolicyModal,
  AcceptLatestTosModal,
  callAuthed,
  ExchangeRateProvider,
  getDeviceId,
  getPushPermissionGranted,
  localDelete,
  localGet,
  localStore,
  requestAndGetExpoToken,
  showToast,
  useBusinessMapCache,
  useInitCurrentLocation,
  useOnAppResume,
  useStaleResume,
} from "@tagly/client";
import {
  getInstagramSnapshotStatus,
  onAppOpen,
  updateEstimatedStoryViews,
} from "@tagly/sdk/v2/customerApp";
import { LOCAL_KEYS } from "@/constants/storageKeys";
import { DrawerProvider, BusinessMapCacheProvider } from "@tagly/client";
import { CustomerProvider, useCustomer } from "@/contexts/Customer";
import {
  InstagramConnectionProvider,
  useInstagramConnection,
} from "@/contexts/instagram/InstagramConnectionContext";
import CustomerDrawer from "@/components/drawer/CustomerDrawer";
import StoryViewsModal from "@/components/storyViews/StoryViewsModal";
import ShareOpportunitySheet from "@/components/shareOpportunity/ShareOpportunitySheet";
import { useShareOpportunity } from "@/hooks/useShareOpportunity";

/**
 * How long the app may sit backgrounded (suspended, not killed) before a reopen
 * is treated as a fresh start — nav reset to home + a re-run cold-start. Tune here.
 */
const STALE_RESUME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Authed app shell. Mounts the shared drawer + customer/Instagram contexts (the
 * contexts own their fetches now), runs the cold-start orchestration in
 * `AppLayoutInner`, then hosts the tab group `(tabs)` + future detail screens
 * with the drawer overlaid.
 *
 * Order matters: `InstagramConnectionProvider` reads `useCustomer` (to patch the
 * IG profile), so it sits **inside** `CustomerProvider`.
 */
export default function AppLayout() {
  return (
    <DrawerProvider>
      <CustomerProvider>
        <InstagramConnectionProvider>
          <BusinessMapCacheProvider>
            <AppLayoutInner />
          </BusinessMapCacheProvider>
        </InstagramConnectionProvider>
      </CustomerProvider>
    </DrawerProvider>
  );
}

function AppLayoutInner() {
  const router = useRouter();
  const { t } = useTranslation("appShell");
  const { resetCache } = useBusinessMapCache();
  const { customer, setCustomer } = useCustomer();
  const {
    instagramState,
    resolveInstagramState,
    setInstagramState,
    setIsTakingSnapshot,
  } = useInstagramConnection();
  // Story views are SERVER-OWNED (E062) — the value is `customer.
  // estimatedStoryViews`, full stop. The only local state is the persisted
  // "asked and dismissed" flag for the nudge sheet. The pre-E062 local value is
  // deliberately NOT backfilled (Matej, 2026-08-02): it's purged on app open
  // and every no-IG user is simply re-nudged once.
  const storyViews = customer?.estimatedStoryViews ?? null;
  const [storyViewsSkipped, setStoryViewsSkipped] = useState(false);
  const [storyViewsHydrated, setStoryViewsHydrated] = useState(false);
  useEffect(() => {
    localGet(LOCAL_KEYS.STORY_VIEWS_SKIPPED).then((flag) => {
      if (flag) setStoryViewsSkipped(true);
      setStoryViewsHydrated(true);
    });
  }, []);
  const skipStoryViews = useCallback(() => {
    setStoryViewsSkipped(true);
    void localStore(LOCAL_KEYS.STORY_VIEWS_SKIPPED, "1");
  }, []);

  const [initialLoad, setInitialLoad] = useState(true);
  // Flips true once the cold-start sequence (customer + IG status) has resolved —
  // gates the share-opportunity detector so it fires with IG state settled.
  const [initDone, setInitDone] = useState(false);

  // Request location permission on the authed home (never at cold launch) and
  // fill CurrentLocationContext. No-op on denial — the map falls back.
  useInitCurrentLocation();

  /**
   * Fire-and-forget app-open side effects (`POST /me/on-app-open`): ensure
   * notification defaults + register this device's push token (with platform,
   * deviceId + timezone) + report the OS notification-permission status so the
   * backend can disable this device's tokens when permission is off (a revoked
   * permission does NOT invalidate the Expo token — without the report, sends
   * keep vanishing into a void). Never blocks app init.
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
      // Read AFTER the token request so a just-granted permission reports true.
      // deviceId lets the backend scope a permission-off disable to this device
      // (when permission is off there is no token to identify it by).
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

  // The IG-state resolution itself lives in `InstagramConnectionContext`
  // (`resolveInstagramState`) so retry surfaces — e.g. the share-create
  // screen's "taking too long" button — can re-run the full resolve too.
  const onInitialLoad = async () => {
    runOnAppOpen(); // fire-and-forget
    await resolveInstagramState();
    // IG state is now settled (CONNECTED / NOT_LINKED / a broken state) unless we
    // were offline (still LOADING). Arm the share-opportunity detector regardless
    // — it self-gates on CONNECTED, so a LOADING state simply never fires it.
    setInitDone(true);
  };

  // App-open "share opportunity" detector (in-business / in-business-with-story).
  const shareOpp = useShareOpportunity(initDone);

  // If the cold-start resolution couldn't reach the backend (offline), it left us
  // in LOADING — retry on the next foreground so a reconnected user's real IG
  // state (and any nudges) surface without an app restart. Refs keep the resume
  // callback stable (no re-subscribe churn) while reading the latest values.
  const initDoneRef = useRef(initDone);
  initDoneRef.current = initDone;
  const instagramStateRef = useRef(instagramState);
  instagramStateRef.current = instagramState;
  useOnAppResume(
    useCallback(() => {
      if (!initDoneRef.current) return;
      if (instagramStateRef.current !== "LOADING") return;
      void resolveInstagramState();
    }, [resolveInstagramState]),
  );

  // Reopening after a long absence (backgrounded, not killed) should feel like a
  // fresh launch, since iOS/Android otherwise restore the exact prior state. Reset
  // navigation to the home tab and re-arm the cold-start gate — flipping
  // `initialLoad` re-runs `onInitialLoad` (refetch customer + IG state + push
  // token); `useInitCurrentLocation` already re-inits location on every resume.
  useStaleResume(
    STALE_RESUME_THRESHOLD_MS,
    useCallback(() => {
      if (router.canDismiss()) router.dismissAll();
      router.replace("/map");
      setInitDone(false);
      setInstagramState("LOADING");
      setInitialLoad(true);
    }, [router, setInstagramState]),
  );

  // Run the cold-start sequence once on mount.
  useEffect(() => {
    if (!initialLoad) return;
    setInitialLoad(false);
    onInitialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoad]);

  // Poll for the audience snapshot while the customer is connected but it hasn't
  // been taken yet, then flip the cached `instagram.hasSnapshot` true on
  // completion — that clears the "rewards calculating" notice + the per-business
  // "soon" states in-session, no refetch. Driven by the pending STATE
  // (`hasSnapshot === false`), not the transient `isTakingSnapshot` queue flag,
  // so it also covers a snapshot queued in a prior session (which never re-sets
  // that flag). Every 15s, 10 attempts; on give-up the notice stays and polling
  // resumes on the next app open (the state is still pending).
  const snapshotPending =
    !!customer?.instagram && customer.instagram.hasSnapshot === false;

  useEffect(() => {
    if (!snapshotPending) return;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 15000;
    let attempts = 0;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      if (attempts >= MAX_ATTEMPTS) return;
      attempts += 1;
      let done = false;
      try {
        const result = await callAuthed(
          router,
          (jwt) => getInstagramSnapshotStatus({ jwt }),
          { suppressAlerts: true },
        );
        if (result.ok && result.data?.hasSnapshot === true) {
          done = true;
          setIsTakingSnapshot(false);
          setCustomer((prev) =>
            prev?.instagram
              ? { ...prev, instagram: { ...prev.instagram, hasSnapshot: true } }
              : prev,
          );
          // The real audience now supersedes the story-views estimate, so the
          // map's cached per-business reward estimates are stale — drop them so
          // the next map view refetches with the true reach. A one-line toast
          // confirms the moment (the "rewards calculating" notices already
          // cleared via the setCustomer patch above).
          resetCache();
          showToast({
            type: "success",
            text1: t("audienceReadyTitle"),
            text2: t("audienceReadyBody"),
          });
        }
      } catch {
        // Best-effort poll.
      }
      if (!cancelled && !done) timeout = setTimeout(poll, INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotPending]);

  // Once Instagram is confirmed working, real audience insights supersede the
  // self-reported story-views estimate — reset the skip flag (a later
  // disconnect re-nudges) and best-effort clear the SERVER copy so a stale
  // guess can't resurface after that disconnect (the pricer ignores the value
  // while IG works either way, so a failed clear is harmless). Fires on the
  // transition into CONNECTED, from the app-open probe or a reconnect. Broken
  // states (MISSING_PERMISSION / DISCONNECTED / EXPIRED_TOKEN) deliberately
  // keep the estimate — it's still the projection fallback until IG actually
  // works again.
  useEffect(() => {
    if (instagramState !== "CONNECTED") return;
    setStoryViewsSkipped(false);
    void localDelete(LOCAL_KEYS.STORY_VIEWS_SKIPPED);
    if (customer?.estimatedStoryViews != null) {
      void callAuthed(
        router,
        (jwt) =>
          updateEstimatedStoryViews({
            jwt,
            body: { estimatedStoryViews: null },
          }),
        { suppressAlerts: true },
      ).then((res) => {
        if (res.ok) {
          setCustomer((prev) =>
            prev ? { ...prev, estimatedStoryViews: null } : prev,
          );
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instagramState]);


  // ── App-open modal cycle ──────────────────────────────────────────────────
  // One blocking/nudge modal at a time, in priority order:
  //   1. Terms of Service update  (blocking — must accept)
  //   2. Privacy Policy update    (blocking — must accept)
  //   3. Story-views nudge        (no-IG users, for reward estimates)
  //   4. Share-opportunity nudge  (in a shareable business, maybe with a matched
  //                                story) — the lowest-priority soft nudge.
  // The old IG-permission-info modal is intentionally dropped: a broken IG
  // connection is already surfaced inline by `InstagramConnectionPrompt` on the
  // Account tab, and the "what we access" disclosure lives in settings.
  const [activeModal, setActiveModal] = useState<
    "tos" | "privacy" | "story-views" | "share-opp" | null
  >(null);

  // The two legal gates are read straight off the cached customer; accepting
  // patches the flag false (in `onFinished` below) so the gate closes without a
  // refetch — a later `reloadCustomer` returns false too (the backend stamped
  // the agreed-at), so it never flips back.
  const shouldAcceptTos = customer?.shouldAgreeWithLatestTos === true;
  const shouldAcceptPrivacy =
    customer?.shouldAgreeWithLatestPrivacyPolicy === true;

  // Session-level dismiss for the story-views nudge (closing the sheet without
  // saving/skipping shouldn't re-open it every render). The persistent
  // suppression is the context's `skipped` flag. State (not a ref) so
  // `desiredModal` recomputes when it flips. Reset once a real number is entered
  // so a later re-trigger isn't stale.
  const [storyViewsDismissed, setStoryViewsDismissed] = useState(false);
  useEffect(() => {
    if (typeof storyViews === "number") setStoryViewsDismissed(false);
  }, [storyViews]);

  // The single modal that SHOULD be showing right now, by priority. Null = none.
  const desiredModal: "tos" | "privacy" | "story-views" | "share-opp" | null =
    shouldAcceptTos
      ? "tos"
      : shouldAcceptPrivacy
        ? "privacy"
        : // No-IG users with no estimate yet: nudge for their typical story views
          // so the map/business cards can project rewards. NOT_LINKED is
          // intentional, so this is a soft nudge, never a block.
          storyViewsHydrated &&
            instagramState === "NOT_LINKED" &&
            storyViews == null &&
            !storyViewsSkipped &&
            !storyViewsDismissed
          ? "story-views"
          : // Lowest priority: the app-open share nudge, only when the detector
            // found a shareable business the customer is standing in.
            shareOpp.scenario.scenario !== "none"
            ? "share-opp"
            : null;

  // Reconcile the mounted sheet toward `desiredModal` ONE at a time. RN on iOS
  // wedges the whole touch layer if two Modals are mounted at once — the outgoing
  // sheet's invisible full-screen backdrop keeps swallowing touches, so the app
  // looks frozen after a modal "closes". So when switching we close the current
  // sheet first and only mount the next once its exit animation has settled.
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

  // Drives the `≈ X Kč` secondary line on money displays for CZ users (via
  // `useFormatBudget`). Defaults to "US" until the customer loads; the provider
  // re-fetches when the locale resolves to "CZ".
  return (
    <ExchangeRateProvider locale={customer?.locale}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <CustomerDrawer />

        <AcceptLatestTosModal
          open={activeModal === "tos"}
          onFinished={() => {
            setCustomer((prev) =>
              prev ? { ...prev, shouldAgreeWithLatestTos: false } : prev,
            );
            setActiveModal(null);
          }}
        />

        <AcceptLatestPrivacyPolicyModal
          open={activeModal === "privacy"}
          onFinished={() => {
            setCustomer((prev) =>
              prev
                ? { ...prev, shouldAgreeWithLatestPrivacyPolicy: false }
                : prev,
            );
            setActiveModal(null);
          }}
        />

        <StoryViewsModal
          open={activeModal === "story-views"}
          onSkip={skipStoryViews}
          onClose={() => {
            setStoryViewsDismissed(true);
            setActiveModal(null);
          }}
        />

        <ShareOpportunitySheet
          open={activeModal === "share-opp"}
          scenario={shareOpp.scenario}
          onClose={() => {
            shareOpp.dismiss();
            setActiveModal(null);
          }}
        />
      </View>
    </ExchangeRateProvider>
  );
}
