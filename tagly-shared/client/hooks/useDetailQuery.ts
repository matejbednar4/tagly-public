import { useQuery, QueryKey } from "@tanstack/react-query";
import type { CallerResult } from "../api/caller";

type UseDetailQueryOpts<TIn, TOut> = {
  /** How long a fetched copy is served without refetching. Default 10 min. */
  staleTime?: number;
  gcTime?: number;
  retry?: number | ((failureCount: number, error: unknown) => boolean);
  /** Map the raw payload (TIn) to the desired shape (TOut). */
  mapData?: (data: TIn) => TOut;
  /** If false, the query will not execute. Defaults to true. */
  enabled?: boolean;
};

/**
 * The standard single-resource detail query (business/share detail screens).
 *
 * A thin `useQuery` wrapper over a `callAuthed`/`callPublic` fetcher that
 * normalizes the caller's `Result` into data-or-throw (so `isError` and the
 * retry policy work off the API error code). Every fetch returns a full fresh
 * body — there is deliberately NO ETag/304 layer, so a pull-to-refresh
 * `refetch()` always yields the server's current state, and staleness is
 * bounded by `staleTime` alone (replaces the old `useETagQuery`, whose probe
 * ETags could under-cover derived fields and pin a stale view indefinitely).
 *
 * Defaults: 10-min stale, 7-day gc, 1 retry (never on 4xx except 429),
 * `placeholderData` keeps the previous copy visible during refetches.
 */
export function useDetailQuery<TIn, TOut = TIn>(
  queryKey: QueryKey,
  fetcher: (args: { signal?: AbortSignal }) => Promise<CallerResult<TIn>>,
  {
    staleTime = 10 * 60 * 1000,
    gcTime = 7 * 24 * 60 * 60 * 1000,
    retry = 1,
    mapData,
    enabled = true,
  }: UseDetailQueryOpts<TIn, TOut> = {}
) {
  return useQuery<TOut>({
    queryKey,
    queryFn: async ({ signal }) => {
      const r = await fetcher({ signal });

      if (!r.ok) {
        const code = r.error?.error.code ?? r.status ?? 500;
        const message =
          r.error?.error.message ?? `Request failed (status ${r.status ?? 0})`;
        throw Object.assign(new Error(message), { code });
      }
      if (!r.data) {
        throw Object.assign(new Error("Malformed response"), { code: 500 });
      }

      return mapData ? mapData(r.data) : (r.data as unknown as TOut);
    },
    staleTime,
    gcTime,
    retry:
      typeof retry === "function"
        ? retry
        : (failureCount, error: any) => {
            const code = (error && (error as any).code) || 0;
            if (code >= 400 && code < 500 && code !== 429) return false; // no retry on 4xx except 429
            return failureCount < Number(retry ?? 1);
          },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // keep previous data visible during refetches
    placeholderData: (prev) => prev as any,
    enabled,
  });
}
