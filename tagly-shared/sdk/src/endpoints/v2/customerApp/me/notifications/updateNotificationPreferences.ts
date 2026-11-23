import {
  UpdateNotificationPreferencesBody,
  UpdateNotificationPreferencesBodySchema,
  UpdateNotificationPreferencesResponse,
  UpdateNotificationPreferencesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/notifications/preferences`. Set the on/off state of
 * one or more events on a channel (the client sends a single update per toggle).
 * Turning off a mandatory channel is reported in `rejected`, not thrown. Authed
 * (JWT).
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
    path: "/v2/customers/me/notifications/preferences",
    body,
    jwt,
    schemas: {
      body: UpdateNotificationPreferencesBodySchema,
      response: UpdateNotificationPreferencesResponseSchema,
    },
  });
}
