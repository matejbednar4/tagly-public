import * as Location from "expo-location";

/**
 * The resolved foreground-location permission state.
 * - `granted` — we have a fix to work with.
 * - `denied` — the user said no (or previously denied and iOS won't re-prompt);
 *   the only way back is the OS Settings app. Consumers surface the
 *   `LocationPermissionNotice` in this state.
 * - `undetermined` — not decided yet / couldn't be read; show nothing.
 */
export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

export type LocationPermissionResult = {
  granted: boolean;
  status: LocationPermissionStatus;
};

/**
 * Ensures **foreground** location permission, prompting at most once, and reports
 * the resolved status so consumers can surface a "denied" affordance.
 *
 * - Already granted → `granted` (no prompt).
 * - Undetermined → shows the system prompt once and returns the result.
 * - Previously denied (`canAskAgain` false) → `denied` without prompting (iOS only
 *   allows one prompt ever; re-asking would no-op).
 * - Error reading the status → `undetermined` (don't falsely claim denial).
 *
 * Never nags or deep-links to Settings itself — callers decide what to do with a
 * denial (the map centers on the home market; a notice offers a Settings jump).
 */
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return { granted: true, status: "granted" };
    // Previously denied — iOS won't prompt again; it's a hard denial.
    if (!current.canAskAgain) return { granted: false, status: "denied" };
    // Undetermined → prompt once.
    const asked = await Location.requestForegroundPermissionsAsync();
    return {
      granted: asked.granted,
      status: asked.granted ? "granted" : "denied",
    };
  } catch {
    return { granted: false, status: "undetermined" };
  }
}
