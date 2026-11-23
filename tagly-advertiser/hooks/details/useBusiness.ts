import { callAuthed, useDetailQuery } from "@tagly/client";
import { getBusinessByUid } from "@tagly/sdk/v2/advertiserApp";
import type {
  BusinessOwnerDetails,
  GetBusinessByUidResponse,
} from "@tagly/models/v2/advertiserApp";
import type { Router } from "expo-router";

/**
 * One of the advertiser's own businesses by uid
 * (`GET /v2/advertisers/me/businesses/:uid`) via `useDetailQuery` — every fetch
 * returns a fresh body (no ETag layer), so pull-to-refresh and stale-time
 * refetches always show the current page state. 10-min stale, 7-day gc (the
 * standard detail cache).
 */
export function useBusiness(
  uid: string,
  router: Router,
  options?: { enabled?: boolean },
) {
  return useDetailQuery<GetBusinessByUidResponse, BusinessOwnerDetails>(
    ["business", uid],
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
