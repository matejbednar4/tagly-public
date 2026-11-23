import {
  ConnectInstagramBody,
  ConnectInstagramBodySchema,
  ConnectInstagramResponse,
  ConnectInstagramResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/instagram/connect`. Link or re-authorize the
 * logged-in customer's Instagram from an OAuth `code` (run the IG OAuth flow
 * first, then pass the code here). Authed (JWT).
 *
 * On 200 → CONNECTED with the refreshed `{ instagram }` profile. The error codes
 * map to connection state (4099 → MISSING_PERMISSION when the insights scope
 * wasn't granted; 2214 → IG already linked elsewhere; 4101 → account mismatch).
 */
export function connectInstagram({
  jwt,
  body,
}: {
  jwt: string;
  body: ConnectInstagramBody;
}): ApiResponse<ConnectInstagramResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/instagram/connect",
    jwt,
    body,
    schemas: {
      body: ConnectInstagramBodySchema,
      response: ConnectInstagramResponseSchema,
    },
  });
}
