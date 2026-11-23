// hooks/pagination/usePagedList.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { Router } from "expo-router";

// Mirrors your PaginatedResponse<T> helper
export type PageEnvelope<T> = {
  items: T[];
  offset: number;
  hasMore: boolean;
};

export type FetchPage<T, Q> = (args: {
  query: Q;
  router: Router;
}) => Promise<PageEnvelope<T>>;

export function usePagedList<T, Q extends { offset: number; limit?: number }>(
  router: Router,
  initialQuery: Omit<Q, "offset">,
  fetchPage: FetchPage<T, Q>
) {
  const [items, setItems] = useState<T[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const queryRef = useRef<Omit<Q, "offset">>(initialQuery);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadNext = useCallback(async () => {
    if (loading || inFlightRef.current) return;
    if (!hasMore && !initializing) return;

    inFlightRef.current = true;
    setLoading(true);

    try {
      const res = await fetchPage({
        router,
        query: { ...(queryRef.current as any), offset } as Q,
      });

      if (!mountedRef.current) return;

      if (Array.isArray(res.items) && res.items.length > 0) {
        setItems((prev) => [...prev, ...res.items]);
      }

      setHasMore(Boolean(res.hasMore));
      setOffset((prev) => prev + 1);
      setInitializing(false);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [router, fetchPage, loading, hasMore, initializing, offset]);

  const reset = useCallback((patch?: Partial<Omit<Q, "offset">>) => {
    if (patch) {
      queryRef.current = { ...queryRef.current, ...patch };
    }
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setInitializing(true);
  }, []);

  const refresh = useCallback(() => reset(), [reset]);

  useEffect(() => {
    if (initializing) {
      loadNext();
    }
  }, [initializing, loadNext]);

  return {
    items,
    loading,
    hasMore,
    offset,
    loadNext,
    reset, // reset with optional query patch
    refresh, // alias for reset()
    getQuery: () => queryRef.current,
    setQuery: (patch: Partial<Omit<Q, "offset">>) => reset(patch),
    isInitializing: initializing,
  };
}
