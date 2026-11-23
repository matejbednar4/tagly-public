import {
  UpdateEstimatedStoryViewsBody,
  UpdateEstimatedStoryViewsBodySchema,
  UpdateEstimatedStoryViewsResponse,
  UpdateEstimatedStoryViewsResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/estimated-story-views`. Sets (or clears
 * with null) the customer's self-reported "typical story views" — the
 * server-owned reach fallback the estimate pricer reads for no-IG customers
 * (E062). No cooldown. Authed (JWT).
 */
export function updateEstimatedStoryViews({
  body,
  jwt,
}: {
  body: UpdateEstimatedStoryViewsBody;
  jwt: string;
}): ApiResponse<UpdateEstimatedStoryViewsResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/estimated-story-views",
    body,
    jwt,
    schemas: {
      body: UpdateEstimatedStoryViewsBodySchema,
      response: UpdateEstimatedStoryViewsResponseSchema,
    },
  });
}
