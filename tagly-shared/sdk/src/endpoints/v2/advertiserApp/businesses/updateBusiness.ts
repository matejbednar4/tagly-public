import {
  GetBusinessByUidParams,
  GetBusinessByUidParamsSchema,
  UpdateBusinessBody,
  UpdateBusinessBodySchema,
  UpdateBusinessResponse,
  UpdateBusinessResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/advertisers/me/businesses/:uid`. Edit one of the
 * advertiser's own business pages. Omitted fields stay unchanged; explicit
 * `null` clears a clearable field; `openingHours` replaces the whole set when
 * present. Banner/photos go through `updateBusinessMedia{Init,Confirm}`.
 * Authed (JWT).
 */
export function updateBusiness({
  params,
  body,
  jwt,
}: {
  params: GetBusinessByUidParams;
  body: UpdateBusinessBody;
  jwt: string;
}): ApiResponse<UpdateBusinessResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/advertisers/me/businesses/:uid",
    params,
    jwt,
    body,
    schemas: {
      params: GetBusinessByUidParamsSchema,
      body: UpdateBusinessBodySchema,
      response: UpdateBusinessResponseSchema,
    },
  });
}
