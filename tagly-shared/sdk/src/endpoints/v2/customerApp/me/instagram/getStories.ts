import {
  GetIgStoriesResponse,
  GetIgStoriesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/instagram/stories`. The logged-in customer's live
 * Instagram stories to pick from when creating a share (already-shared ones are
 * filtered server side). Authed (JWT).
 */
export function getIgStories({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetIgStoriesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/instagram/stories",
    jwt,
    schemas: {
      response: GetIgStoriesResponseSchema,
    },
  });
}
