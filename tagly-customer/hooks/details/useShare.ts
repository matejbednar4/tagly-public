import { callAuthed, useDetailQuery } from "@tagly/client";
import { getShareByUid } from "@tagly/sdk/v2/customerApp";
import type {
  CustomerShareDetails,
  GetShareByUidResponse,
} from "@tagly/models/v2/customerApp";
import type { Router } from "expo-router";

/**
 * The logged-in customer's own share by uid (`GET /v2/customers/shares/:uid`)
 * via `useDetailQuery` — every fetch returns a fresh body (no ETag layer), so
 * pull-to-refresh always reflects newly-landed insights or a resolved report.
 * 10-min stale, 7-day gc (the standard detail cache).
 */
export function useShare(uid: string, router: Router) {
  return useDetailQuery<GetShareByUidResponse, CustomerShareDetails>(
    ["share", uid],
    ({ signal }) =>
      callAuthed(router, (jwt) =>
        getShareByUid({
          jwt,
          params: { uid },
          signal,
        }),
      ),
    {
      mapData: (d) => d.share,
    },
  );
}
