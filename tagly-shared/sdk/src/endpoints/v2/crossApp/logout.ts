import {
  LogOutBody,
  LogOutBodySchema,
  LogOutResponse,
  LogOutResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/cross/logout`. Server-side half of logout: disables this
 * device's push token and clears the web JWT cookie. Authed (JWT from either
 * app). Best-effort — the client still drops its own stored JWT regardless of
 * the result. Exported via `@tagly/sdk/v2/crossApp`.
 */
export function logOut({
  body,
  jwt,
}: {
  body: LogOutBody;
  jwt: string;
}): ApiResponse<LogOutResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/cross/logout",
    body,
    jwt,
    schemas: {
      body: LogOutBodySchema,
      response: LogOutResponseSchema,
    },
  });
}
