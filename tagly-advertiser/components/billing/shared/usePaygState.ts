import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { callAuthed } from "@tagly/client";
import { getPaygState } from "@tagly/sdk/v2/advertiserApp";
import type { GetPaygStateResponse } from "@tagly/models/v2/advertiserApp";

/**
 * Shared PAYG-state query — one `GET /v2/.../billing/payg` behind every billing
 * surface (the pay-as-you-go row, `PaygSheet`, `CardSheet`'s job list),
 * normally read through the composed `useFundingState` rather than directly.
 * Pure DB read — the card's details ride the separate `useSavedCard` query (the
 * one endpoint that talks to Stripe).
 *
 * Semantics: stale-while-revalidate. Consumers render instantly from cache
 * (no spinner when reopening the sheet) while `staleTime: 0` keeps the
 * "always re-check on open" behavior — the card can change from a webhook or
 * another device, so the cache is never trusted blindly, it just removes the
 * blocking spinner. Pass `enabled: false` while a surface is closed (the
 * sheet) so merely mounting it doesn't hit the endpoint. Failures surface as
 * the query's error state; consumers degrade to their sell/link state, same
 * as the old inline fetches. Sign-in/out clears the whole query cache
 * (`SessionContext`), so state never leaks across accounts.
 *
 * Writes: after an authoritative outcome, invalidate the key (fresh link /
 * card update — the new card's brand/last4 must be refetched) or patch the
 * cache via `setQueryData` when the outcome is fully known client-side
 * (disconnect). See `PaygSheet`.
 */
export const PAYG_STATE_QUERY_KEY = ["payg-state"] as const;

export function usePaygState({ enabled = true }: { enabled?: boolean } = {}) {
  const router = useRouter();
  return useQuery({
    queryKey: PAYG_STATE_QUERY_KEY,
    enabled,
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<GetPaygStateResponse> => {
      const res = await callAuthed(router, (jwt) => getPaygState({ jwt }), {
        suppressAlerts: true,
      });
      if (!res.ok || !res.data) throw new Error("PAYG state fetch failed");
      return res.data;
    },
  });
}
