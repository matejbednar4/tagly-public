import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Fires `onStale` when the app returns to the foreground after having been
 * backgrounded for longer than `thresholdMs`.
 *
 * iOS/Android only *suspend* a backgrounded app (unless the user swipes it away),
 * so on reopen the JS context, React state, and navigation stack are all restored
 * exactly as they were left — nothing re-runs. This hook lets a screen treat a
 * long absence as a fresh start (reset navigation, re-run cold-start fetches, …)
 * without depending on the process actually being killed.
 *
 * The "left" moment is captured on the first transition *out* of `active`
 * (`active → inactive`, which precedes `background`), so a brief `inactive` blip
 * (control centre, the app switcher, a permission dialog) that returns within the
 * threshold never triggers a reset. `onStale` is read through a ref, so passing a
 * fresh closure each render does not re-subscribe the listener.
 */
export function useStaleResume(thresholdMs: number, onStale: () => void) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const leftAt = useRef<number | null>(null);
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;

      if (prev === "active" && next !== "active") {
        // App is leaving the foreground — stamp when.
        leftAt.current = Date.now();
      } else if (next === "active" && prev !== "active") {
        // App is coming back — reset if it was gone long enough.
        const departedAt = leftAt.current;
        leftAt.current = null;
        if (departedAt !== null && Date.now() - departedAt > thresholdMs) {
          onStaleRef.current();
        }
      }
    });
    return () => subscription.remove();
  }, [thresholdMs]);
}
