import {
  RefreshInstagramResponse,
  RefreshInstagramResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/instagram/refresh`. The cold-start IG probe:
 * verifies the live connection + permission, refreshes the cached profile, and
 * queues an audience snapshot if stale. Authed (JWT).
 *
 * On 200 → CONNECTED with `{ instagram, snapshotQueued, alreadyHadSnapshot }`.
 * The error codes map to connection state (4099 → MISSING_PERMISSION,
 * 5007/5008 → DISCONNECTED, 5009/5110 → EXPIRED_TOKEN).
 */
export function refreshInstagram({
  jwt,
}: {
  jwt: string;
}): ApiResponse<RefreshInstagramResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/instagram/refresh",
    jwt,
    schemas: {
      response: RefreshInstagramResponseSchema,
    },
  });
}
