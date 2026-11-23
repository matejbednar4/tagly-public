import React, { createContext, useContext, useEffect, useState } from "react";
import { localGet, localStore } from "../services/storage/localStorage";
import { SHARED_LOCAL_KEYS } from "../services/storage/keys";
import { getLocaleDefaults, type Language } from "../i18n/detectLocale";
import { setAppLanguage } from "../i18n/index";

type DistanceUnit = "KM" | "MI";

/**
 * Cross-app user preferences: locale-driven display settings (distance unit,
 * language). Shared by the customer and advertiser apps — app- or domain-specific
 * settings do NOT belong here. Hydrated from local storage on mount; on first
 * launch the defaults are derived from the device OS locale and persisted so later
 * manual changes are never overridden.
 */
interface UserPreferencesContextValue {
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;
  displayLanguage: Language;
  setDisplayLanguage: (lang: Language) => void;
  hydrated: boolean;
}

const UserPreferencesContext = createContext<
  UserPreferencesContextValue | undefined
>(undefined);

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  }
  return context;
};

export const UserPreferencesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>("KM");
  const [displayLanguage, setDisplayLanguageState] = useState<Language>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedDistance, storedLanguage, localeDetected] =
          await Promise.all([
            localGet(SHARED_LOCAL_KEYS.DISTANCE_UNIT),
            localGet(SHARED_LOCAL_KEYS.DISPLAY_LANGUAGE),
            localGet(SHARED_LOCAL_KEYS.LOCALE_DETECTED),
          ]);

        // On first launch (no stored prefs) detect defaults from the device OS locale.
        // Once detected the flag is set so we never override manual user choices.
        if (!localeDetected) {
          const defaults = getLocaleDefaults();

          const finalDistance =
            storedDistance === "KM" || storedDistance === "MI"
              ? storedDistance
              : defaults.distanceUnit;
          const finalLanguage =
            storedLanguage === "en" || storedLanguage === "cs"
              ? storedLanguage
              : defaults.language;

          setDistanceUnitState(finalDistance);
          setDisplayLanguageState(finalLanguage);
          setAppLanguage(finalLanguage);

          await Promise.all([
            localStore(SHARED_LOCAL_KEYS.DISTANCE_UNIT, finalDistance),
            localStore(SHARED_LOCAL_KEYS.DISPLAY_LANGUAGE, finalLanguage),
            localStore(SHARED_LOCAL_KEYS.LOCALE_DETECTED, "1"),
          ]);
          return;
        }

        if (storedDistance === "KM" || storedDistance === "MI") {
          setDistanceUnitState(storedDistance);
        }
        if (storedLanguage === "en" || storedLanguage === "cs") {
          setDisplayLanguageState(storedLanguage);
          setAppLanguage(storedLanguage);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setDistanceUnit = (unit: DistanceUnit) => {
    setDistanceUnitState(unit);
    localStore(SHARED_LOCAL_KEYS.DISTANCE_UNIT, unit);
  };

  const setDisplayLanguage = (lang: Language) => {
    setDisplayLanguageState(lang);
    setAppLanguage(lang);
    localStore(SHARED_LOCAL_KEYS.DISPLAY_LANGUAGE, lang);
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        distanceUnit,
        setDistanceUnit,
        displayLanguage,
        setDisplayLanguage,
        hydrated,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};
