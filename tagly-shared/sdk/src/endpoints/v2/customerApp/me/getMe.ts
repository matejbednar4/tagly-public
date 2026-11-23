import {
  GetMeResponse,
  GetMeResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me`. Fetch the logged-in customer's lean core
 * profile. Authed (JWT). Pure read — app-open side-effects (notification
 * defaults, push token, IG refresh) live in the on-app-open endpoint.
 */
export function getMe({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetMeResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me",
    jwt,
    schemas: {
      response: GetMeResponseSchema,
    },
  });
}
