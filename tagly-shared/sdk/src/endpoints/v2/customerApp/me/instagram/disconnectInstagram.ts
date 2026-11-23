import {
  DisconnectInstagramResponse,
  DisconnectInstagramResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/customers/me/instagram`. Disconnect the logged-in customer's
 * Instagram (hard delete of the account row + cascade), voiding any in-flight
 * shares and releasing their locks, so a different account can be connected
 * without inheriting the old one's audience data. Authed (JWT).
 *
 * Idempotent → 200 `{ message }` even when nothing was linked. The caller clears
 * its cached `customer.instagram` and drops back to the NOT_LINKED state.
 */
export function disconnectInstagram({
  jwt,
}: {
  jwt: string;
}): ApiResponse<DisconnectInstagramResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/customers/me/instagram",
    jwt,
    schemas: {
      response: DisconnectInstagramResponseSchema,
    },
  });
}
