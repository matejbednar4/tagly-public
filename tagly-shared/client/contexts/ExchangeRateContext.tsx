import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SupportedLocale } from "@tagly/models/shared";
import { localGet, localStore } from "../services/storage/localStorage";
import { SHARED_LOCAL_KEYS } from "../services/storage/keys";

const FRANKFURTER_URL =
  "https://api.frankfurter.dev/v1/latest?from=USD&to=CZK";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CachedRate = { rate: number; fetchedAt: number };

interface ExchangeRateContextValue {
  /** Viewer's locale. `undefined` outside an `ExchangeRateProvider` (callers fall back to USD). */
  locale: SupportedLocale | undefined;
  /**
   * USD→CZK rate. `null` when locale is not CZ, when the cache is empty and
   * the first fetch hasn't succeeded yet, or when fetching has failed without
   * any prior cached value. `useFormatBudget` silently falls back to USD when
   * this is `null`.
   */
  rate: number | null;
  /**
   * `true` once the cache-read attempt has completed (and, for CZ users, the
   * first fetch attempt has resolved). Mount provider gates can wait on this
   * to avoid a flash of USD before CZK on first render.
   */
  hydrated: boolean;
  /** Imperative refetch. Rarely needed — the provider refreshes on its own. */
  refresh: () => Promise<void>;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue>({
  locale: undefined,
  rate: null,
  hydrated: false,
  refresh: async () => {},
});

export function useExchangeRate(): ExchangeRateContextValue {
  return useContext(ExchangeRateContext);
}

/**
 * Fetches and caches the USD→CZK exchange rate for CZ-locale users.
 *
 * Behavior:
 * - Reads cache from AsyncStorage on mount.
 * - For non-CZ locales, never fetches and leaves `rate = null`.
 * - For CZ locale: if cache is fresh (<24h) uses cached value. Otherwise
 *   exposes any stale rate immediately (avoids USD flash) then fetches in the
 *   background. On fetch success the cache is updated; on failure with no
 *   cache, `rate` stays `null` (USD fallback); on failure with stale cache,
 *   the stale rate is kept.
 */
export function ExchangeRateProvider({
  locale,
  children,
}: {
  locale?: SupportedLocale;
  children: React.ReactNode;
}) {
  const [rate, setRate] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchAndPersist = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const p = (async () => {
      try {
        const res = await fetch(FRANKFURTER_URL);
        if (!res.ok) return;
        const json = (await res.json()) as { rates?: { CZK?: number } };
        const next = json?.rates?.CZK;
        if (typeof next === "number" && Number.isFinite(next) && next > 0) {
          setRate(next);
          await localStore(
            SHARED_LOCAL_KEYS.USD_CZK_RATE,
            JSON.stringify({
              rate: next,
              fetchedAt: Date.now(),
            } satisfies CachedRate),
          );
        }
      } catch {
        // Silent failure — caller falls back to USD or stale cache.
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = p;
    return p;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (locale !== "CZ") {
          if (!cancelled) setRate(null);
          return;
        }
        const raw = await localGet(SHARED_LOCAL_KEYS.USD_CZK_RATE);
        let cached: CachedRate | null = null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as CachedRate;
            if (
              typeof parsed?.rate === "number" &&
              Number.isFinite(parsed.rate) &&
              parsed.rate > 0 &&
              typeof parsed?.fetchedAt === "number"
            ) {
              cached = parsed;
            }
          } catch {
            // Corrupt cache — ignore and refetch.
          }
        }
        if (cached && !cancelled) setRate(cached.rate);
        const stale =
          !cached || Date.now() - cached.fetchedAt >= REFRESH_INTERVAL_MS;
        if (stale) {
          await fetchAndPersist();
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, fetchAndPersist]);

  const value = useMemo<ExchangeRateContextValue>(
    () => ({ locale, rate, hydrated, refresh: fetchAndPersist }),
    [locale, rate, hydrated, fetchAndPersist],
  );

  return (
    <ExchangeRateContext.Provider value={value}>
      {children}
    </ExchangeRateContext.Provider>
  );
}
