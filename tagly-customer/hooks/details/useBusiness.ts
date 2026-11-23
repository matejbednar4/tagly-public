import { callAuthed, useDetailQuery } from "@tagly/client";
import { getBusinessByUid } from "@tagly/sdk/v2/customerApp";
import type {
  BusinessPublicDetails,
  GetBusinessByUidResponse,
} from "@tagly/models/v2/customerApp";
import type { Router } from "expo-router";
import { useCustomer } from "@/contexts/Customer";

/**
 * A business by uid (`GET /v2/customers/businesses/:uid`) via `useDetailQuery` —
 * every fetch returns a fresh body (no ETag layer), so pull-to-refresh and
 * stale-time refetches always pick up derived fields (reward estimate,
 * `isLowBudget`). The story-views estimate is server-owned (E062) and not sent
 * on the wire; it stays in the cache key purely so a change refetches the
 * server-priced estimate. 10-min stale, 7-day gc (the standard detail cache).
 */
export function useBusiness(
  uid: string,
  router: Router,
  options?: { enabled?: boolean },
) {
  // Server-owned (E062); in the cache key purely as a refetch trigger.
  const storyViews = useCustomer().customer?.estimatedStoryViews ?? null;

  return useDetailQuery<GetBusinessByUidResponse, BusinessPublicDetails>(
    ["business", uid, storyViews],
    ({ signal }) =>
      callAuthed(router, (jwt) =>
        getBusinessByUid({
          jwt,
          params: { uid },
          signal,
        }),
      ),
    {
      mapData: (d) => d.business,
      enabled: options?.enabled,
    },
  );
}
