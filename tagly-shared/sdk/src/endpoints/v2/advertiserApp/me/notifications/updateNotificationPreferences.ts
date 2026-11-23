import {
  UpdateNotificationPreferencesBody,
  UpdateNotificationPreferencesBodySchema,
  UpdateNotificationPreferencesResponse,
  UpdateNotificationPreferencesResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/notifications/preferences`. Toggle one or more
 * events on a channel (instant-persist; body accepts a batch). Mandatory channels
 * can't be turned off (reported in `rejected`). Authed (JWT).
 */
export function updateNotificationPreferences({
  body,
  jwt,
}: {
  body: UpdateNotificationPreferencesBody;
  jwt: string;
}): ApiResponse<UpdateNotificationPreferencesResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/notifications/preferences",
    body,
    jwt,
    schemas: {
      body: UpdateNotificationPreferencesBodySchema,
      response: UpdateNotificationPreferencesResponseSchema,
    },
  });
}
