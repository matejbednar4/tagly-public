import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { callAuthed, useCurrentLocation } from "@tagly/client";
import { getShareOpportunity } from "@tagly/sdk/v2/customerApp";
import type { GetShareOpportunityResponse } from "@tagly/models/v2/customerApp";
import { useInstagramConnection } from "@/contexts/instagram/InstagramConnectionContext";
import { useCustomer } from "@/contexts/Customer";

// Minimum time the app must sit in the background before the detector re-fires on
// resume — stops it spamming on brief app switches / notification-shade pulls.
// Mirrors origin/main's app-open prompt (20s).
const MIN_BACKGROUND_MS = 20_000;

// ms the app entered the background; null = foreground / never left. Module-level
// so it survives re-renders, same technique as origin/main's app-open prompt.
let backgroundedAt: number | null = null;

/**
 * Powers the app-open "share opportunity" nudge (the two v2 scenarios).
 *
 * Once the cold-start sequence has finished (`initDone`) — and again on every
 * resume after ≥20s in the background — it asks the backend detector
 * (`GET /me/share-opportunity`) whether the customer is standing inside a
 * shareable Tagly business, optionally with a live story that already tags it.
 * The result drives `ShareOpportunitySheet` through the app-open modal cycle in
 * `(app)/_layout.tsx`.
 *
 * Gates (all must hold, else it stays `none` and no sheet shows):
 *   - Instagram is CONNECTED — a share needs a live story, and the detector runs
 *     Rekognition over the customer's stories.
 *   - Device location is known — both scenarios are location-based (the endpoint
 *     requires `currentLat`/`currentLon`, so we can't call without it).
 *   - The user isn't mid share-creation — never interrupt that flow. origin/main
 *     used an explicit `suppressAppOpenCheck()` flag toggled by the create stack;
 *     v2 has no create-stack layout, so we read the current route instead.
 *
 * `dismiss()` resets to `none`; the detector re-arms on the next qualifying
 * resume (there is no `lastOpenedAt` baseline — unlike origin/main's dropped
 * "new content" scenario, these two are purely location-driven).
 */
export function useShareOpportunity(initDone: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentLocation } = useCurrentLocation();
  const { instagramState } = useInstagramConnection();
  const { customer } = useCustomer();
  // Server-owned (E062); dep below re-runs the detector when it changes.
  const storyViews = customer?.estimatedStoryViews;

  const [scenario, setScenario] = useState<GetShareOpportunityResponse>({
    scenario: "none",
  });

  // Read the live route inside the (memoized) runCheck without making it a dep —
  // navigating shouldn't re-fire the detector.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // One detection per cold start / qualifying resume; `running` de-dupes overlap.
  const checkedRef = useRef(false);
  const runningRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (!initDone) return;
    if (instagramState !== "CONNECTED") return;
    if (!currentLocation) return;
    // Never interrupt the share-create flow (picker → confirm → tag).
    if (pathnameRef.current.startsWith("/shares/create")) return;
    if (checkedRef.current || runningRef.current) return;

    checkedRef.current = true;
    runningRef.current = true;
    try {
      const result = await callAuthed(
        router,
        (jwt) =>
          getShareOpportunity({
            jwt,
            query: {
              currentLat: currentLocation.latitude,
              currentLon: currentLocation.longitude,
            },
          }),
        { suppressAlerts: true },
      );
      if (result.ok && result.data && result.data.scenario !== "none") {
        setScenario(result.data);
      }
    } catch {
      // Silent — a failed detector just means no nudge; the user enters normally.
    } finally {
      runningRef.current = false;
    }
  }, [initDone, instagramState, currentLocation, storyViews, router]);

  // Fire once conditions are met; re-runs as location / IG state resolve.
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  // Re-arm + re-check on resume, but only after a long enough background stint.
  // Records the FIRST departure (iOS goes active→inactive→background) so brief
  // interactions are measured correctly, exactly like origin/main.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "inactive" || state === "background") {
        if (backgroundedAt === null) backgroundedAt = Date.now();
      } else if (state === "active") {
        if (backgroundedAt === null) return; // cold start handled by the effect above
        const elapsed = Date.now() - backgroundedAt;
        backgroundedAt = null;
        if (elapsed >= MIN_BACKGROUND_MS) {
          checkedRef.current = false;
          void runCheck();
        }
      }
    });
    return () => sub.remove();
  }, [runCheck]);

  const dismiss = useCallback(() => {
    setScenario({ scenario: "none" });
  }, []);

  return { scenario, dismiss };
}
