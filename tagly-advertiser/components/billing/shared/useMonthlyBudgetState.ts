import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { callAuthed } from "@tagly/client";
import { getMonthlyBudget } from "@tagly/sdk/v2/advertiserApp";
import type { GetMonthlyBudgetResponse } from "@tagly/models/v2/advertiserApp";

/**
 * Shared monthly-budget-state query — one `GET /v2/.../billing/monthly-budget`
 * behind every surface that shows the monthly top-up (the "How you pay" row,
 * `MonthlyTopUpSheet`, `CardSheet`'s job list), normally read through the
 * composed `useFundingState` rather than directly. The twin of `usePaygState`:
 * stale-while-revalidate (`staleTime: 0`), so a reopen renders from cache with
 * no spinner while a background refetch self-corrects. Pass `enabled: false`
 * while a surface is closed (the sheets). Failures surface as the query's
 * error state; consumers degrade to their off/enable state.
 *
 * Writes: after an authoritative outcome `MonthlyTopUpSheet` **sets** the
 * cache from the last `GET` of its post-`PUT` poll (the `PUT` itself only
 * returns `{ active }`) or invalidates it (disable). Every card change
 * invalidates it too — via `useCardLink` on a link (which flips `hasCard`) and
 * `CardSheet` on a removal (which closes the period server-side).
 */
export const MONTHLY_BUDGET_STATE_QUERY_KEY = ["monthly-budget-state"] as const;

export function useMonthlyBudgetState({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const router = useRouter();
  return useQuery({
    queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY,
    enabled,
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<GetMonthlyBudgetResponse> => {
      const res = await callAuthed(router, (jwt) => getMonthlyBudget({ jwt }), {
        suppressAlerts: true,
      });
      if (!res.ok || !res.data) {
        throw new Error("monthly budget state fetch failed");
      }
      return res.data;
    },
  });
}
