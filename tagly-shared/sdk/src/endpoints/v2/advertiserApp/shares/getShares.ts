import {
  GetAdvertiserSharesBody,
  GetAdvertiserSharesBodySchema,
  GetAdvertiserSharesResponse,
  GetAdvertiserSharesResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/shares`. The logged-in advertiser's own shares
 * (across all their businesses), offset-paginated (newest first by default).
 * POST + body so it plugs into the shared `makeOffsetFetcher`/`PaginatedList`
 * convention. Authed (JWT).
 */
export function getMyShares({
  body,
  jwt,
}: {
  body: GetAdvertiserSharesBody;
  jwt: string;
}): ApiResponse<GetAdvertiserSharesResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/shares",
    body,
    jwt,
    schemas: {
      body: GetAdvertiserSharesBodySchema,
      response: GetAdvertiserSharesResponseSchema,
    },
  });
}
