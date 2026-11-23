import {
  SaveProfileBody,
  SaveProfileBodySchema,
  SaveProfileResponse,
  SaveProfileResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/save-profile`. Persist name, gender, and
 * interests onto the PendingCustomer (finish-profile step).
 */
export function saveProfile(
  body: SaveProfileBody,
): ApiResponse<SaveProfileResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/save-profile",
    body,
    schemas: {
      body: SaveProfileBodySchema,
      response: SaveProfileResponseSchema,
    },
  });
}
