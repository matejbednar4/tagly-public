import {
  OnAppOpenBody,
  OnAppOpenBodySchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/on-app-open`. Fire-and-forget app-open
 * side-effects: ensure notification defaults + register the Expo push token (if
 * provided). Authed (JWT). Returns 204 (no body).
 */
export function onAppOpen({
  jwt,
  body,
}: {
  jwt: string;
  body: OnAppOpenBody;
}): ApiResponse<void | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/on-app-open",
    jwt,
    body,
    schemas: {
      body: OnAppOpenBodySchema,
    },
  });
}
