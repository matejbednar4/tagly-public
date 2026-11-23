import { useCallback, useEffect } from "react";
import * as Location from "expo-location";
import { useCurrentLocation } from "../contexts/CurrentLocationContext";
import { requestLocationPermission } from "../services/permissions/requestLocationPermission";
import { useOnAppResume } from "./useOnAppResume";

/**
 * Requests foreground location permission (once) and fills
 * `CurrentLocationContext`. Mount this **once** inside an authed shell (e.g.
 * `(app)/_layout`) — never at cold launch — so the prompt lands on the authed
 * home where location is actually used, not on a logged-out user.
 *
 * Flow on grant: set the context immediately from the cached last-known position
 * (fast initial region), then refine with a fresh fix. Re-runs on app foreground
 * so a permission granted later in Settings is picked up, and to keep the fix
 * reasonably current. There is **no continuous watch** — the map's native
 * `showsUserLocation` draws the live dot; we only need a coarse anchor.
 *
 * On denial it does nothing — consumers fall back (the map centers on the home
 * market).
 */
export function useInitCurrentLocation() {
  const { setCurrentLocation, setPermissionStatus } = useCurrentLocation();

  const init = useCallback(async () => {
    const { granted, status } = await requestLocationPermission();
    // Record the resolved status so consumers can surface the denied notice; a
    // grant made later in Settings is picked up on resume and clears it.
    setPermissionStatus(status);
    if (!granted) return;
    try {
      // Fast path: cached last-known position for an immediate region.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setCurrentLocation({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        });
      }
      // Refine with a current fix.
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      });
    } catch {
      // Keep whatever we have (possibly nothing) — consumers fall back.
    }
  }, [setCurrentLocation, setPermissionStatus]);

  useEffect(() => {
    void init();
  }, [init]);

  // Pick up a grant made later in Settings + keep the fix fresh.
  useOnAppResume(() => void init());
}
