import {
  ListNotificationSettingsQuery,
  ListNotificationSettingsQuerySchema,
  ListNotificationSettingsResponse,
  ListNotificationSettingsResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/notifications`. The advertiser's configurable
 * notifications for one channel (PUSH or EMAIL), grouped by category with each
 * event's effective on/off + mandatory state. Authed (JWT).
 */
export function listNotificationSettings({
  query,
  jwt,
}: {
  query: ListNotificationSettingsQuery;
  jwt: string;
}): ApiResponse<ListNotificationSettingsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/notifications",
    query,
    jwt,
    schemas: {
      query: ListNotificationSettingsQuerySchema,
      response: ListNotificationSettingsResponseSchema,
    },
  });
}
