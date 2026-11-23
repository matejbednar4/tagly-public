import React, { createContext, useState, useContext } from "react";
import type { LocationPermissionStatus } from "../services/permissions/requestLocationPermission";

type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Holds the device's current coordinates **and** the resolved location-permission
 * status. Pure state holder — the actual geolocation request lives in the shared
 * `useInitCurrentLocation` hook (mounted once in each app's authed shell), which
 * calls `setCurrentLocation` + `setPermissionStatus`. Consumers read
 * `permissionStatus === "denied"` to decide whether to surface the
 * `LocationPermissionNotice`. Shared across the customer and advertiser apps.
 *
 * `permissionStatus` defaults to `"undetermined"` so nothing flashes before the
 * first permission check has run.
 */
const CurrentLocationContext = createContext<{
  currentLocation: Coordinates | undefined;
  setCurrentLocation: React.Dispatch<
    React.SetStateAction<Coordinates | undefined>
  >;
  permissionStatus: LocationPermissionStatus;
  setPermissionStatus: React.Dispatch<
    React.SetStateAction<LocationPermissionStatus>
  >;
}>({
  currentLocation: undefined,
  setCurrentLocation: () => {},
  permissionStatus: "undetermined",
  setPermissionStatus: () => {},
});

export const useCurrentLocation = () => useContext(CurrentLocationContext);

export const CurrentLocationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [currentLocation, setCurrentLocation] = useState<
    Coordinates | undefined
  >(undefined);
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>("undetermined");

  return (
    <CurrentLocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        permissionStatus,
        setPermissionStatus,
      }}
    >
      {children}
    </CurrentLocationContext.Provider>
  );
};
