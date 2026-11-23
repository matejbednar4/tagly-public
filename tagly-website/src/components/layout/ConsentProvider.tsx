"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  readConsent,
  writeConsent,
  type ConsentValue,
} from "@/lib/consent/consent-cookie";

// Consent is asked of EVERY visitor, with no geo/region detection: analytics
// load only after an explicit accept, everywhere. The site previously gated the
// banner on a browser-timezone guess at whether the visitor was in the EU/EEA/UK
// and loaded analytics unprompted otherwise. That was dropped 2026-08-08 for two
// reasons: the timezone is a user-controlled setting that privacy browsers
// report as "UTC", so EU visitors were silently classed non-EU and got GA +
// Clarity session recording with no prompt; and with the home market now Prague,
// nearly every visitor needs the prompt anyway. Don't reintroduce client-side
// region detection here — if geo-gating is ever wanted, it belongs server-side.

type ConsentContextValue = {
  /** The stored choice, or null when the visitor has not answered yet. */
  consent: ConsentValue | null;
  /**
   * False during SSR and the first client render, before the cookie has been
   * read. Consumers must wait for it: rendering off `consent` alone would flash
   * the banner at visitors who already answered.
   */
  ready: boolean;
  setConsent: (value: ConsentValue) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsentState(readConsent());
    setReady(true);
  }, []);

  const setConsent = useCallback((value: ConsentValue) => {
    writeConsent(value);
    setConsentState(value);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, ready, setConsent }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used inside a ConsentProvider");
  }
  return ctx;
}
