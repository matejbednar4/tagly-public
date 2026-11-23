import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State machine shared by the four Review queue screens. A queue serves a
 * fixed page of the OLDEST items plus the full outstanding `total` — no
 * pagination: acting on an item calls `remove(key)`, and when the visible
 * page empties while more items remain outstanding the hook auto-refetches
 * the next oldest batch.
 */
export function useReviewQueue<T>(
  fetchPage: () => Promise<{ items: T[]; total: number } | null>,
  keyOf: (item: T) => string,
) {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // The latest fetcher without re-running the mount effect on identity churn.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async () => {
    const page = await fetchRef.current();
    if (page) {
      setItems(page.items);
      setTotal(page.total);
    } else {
      // Failed fetch: leave an already-loaded list untouched (a flaky refresh
      // must not wipe it); only resolve a never-loaded screen to the empty
      // state so it doesn't spin forever.
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Latest items snapshot for `remove` (kept outside the setState updater so
  // the refetch side effect stays pure and single-fire under StrictMode).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** Optimistically drop an acted-on item; pull the next batch when the page empties. */
  const remove = useCallback(
    (key: string) => {
      setTotal((t) => Math.max(0, t - 1));
      const next = (itemsRef.current ?? []).filter((i) => keyOf(i) !== key);
      setItems(next);
      if (next.length === 0) void load();
    },
    // keyOf is stable per screen (defined at module/screen scope).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return { items, total, refreshing, onRefresh, remove, reload: load };
}
