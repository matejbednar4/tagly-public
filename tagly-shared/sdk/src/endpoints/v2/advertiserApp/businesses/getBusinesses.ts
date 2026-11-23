import {
  GetBusinessesResponse,
  GetBusinessesResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/businesses`. The advertiser's own business
 * pages (non-deleted), newest first, as lean owner-facing preview cards.
 * Authed (JWT).
 */
export function getBusinesses({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetBusinessesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/businesses",
    jwt,
    schemas: {
      response: GetBusinessesResponseSchema,
    },
  });
}
