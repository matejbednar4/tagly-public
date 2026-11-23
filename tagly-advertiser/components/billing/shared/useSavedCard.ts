import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { callAuthed } from "@tagly/client";
import { getSavedCard } from "@tagly/sdk/v2/advertiserApp";
import type { GetSavedCardResponse } from "@tagly/models/v2/advertiserApp";

/**
 * Shared saved-card query — `GET /v2/.../billing/payment-method`, the
 * account's ONE off-session card (shared by pay-as-you-go and the monthly
 * top-up), live from Stripe. It backs `CardSheet` (brand, last4, expiry) and
 * tells the rule sheets whether turning on needs a card-link step first;
 * surfaces normally read it through the composed `useFundingState`. Same
 * semantics as `usePaygState`: stale-while-revalidate, `enabled` gating,
 * invalidated after a link (`useCardLink`) or a removal (`CardSheet`).
 */
export const SAVED_CARD_QUERY_KEY = ["saved-card"] as const;

export function useSavedCard({ enabled = true }: { enabled?: boolean } = {}) {
  const router = useRouter();
  return useQuery({
    queryKey: SAVED_CARD_QUERY_KEY,
    enabled,
    staleTime: 0,
    retry: 1,
    queryFn: async (): Promise<GetSavedCardResponse> => {
      const res = await callAuthed(router, (jwt) => getSavedCard({ jwt }), {
        suppressAlerts: true,
      });
      if (!res.ok || !res.data) throw new Error("saved card fetch failed");
      return res.data;
    },
  });
}
