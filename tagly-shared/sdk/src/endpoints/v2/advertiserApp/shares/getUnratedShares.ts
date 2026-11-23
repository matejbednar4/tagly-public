import {
  GetUnratedSharesResponse,
  GetUnratedSharesResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/shares/unrated`. The advertiser's oldest unrated
 * shares (the "shares to rate" home strip) plus the total outstanding count.
 * Authed (JWT). Pure read.
 */
export function getUnratedShares({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetUnratedSharesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/shares/unrated",
    jwt,
    schemas: {
      response: GetUnratedSharesResponseSchema,
    },
  });
}
