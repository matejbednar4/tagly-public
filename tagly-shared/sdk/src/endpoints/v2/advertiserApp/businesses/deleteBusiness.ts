import {
  GetBusinessByUidParams,
  GetBusinessByUidParamsSchema,
  DeleteBusinessResponse,
  DeleteBusinessResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/advertisers/me/businesses/:uid`. Remove one of the
 * advertiser's own business pages (marked DELETED immediately, hard-purged by
 * a worker once in-flight shares settle — those still pay out). Authed (JWT).
 */
export function deleteBusiness({
  params,
  jwt,
}: {
  params: GetBusinessByUidParams;
  jwt: string;
}): ApiResponse<DeleteBusinessResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/advertisers/me/businesses/:uid",
    params,
    jwt,
    schemas: {
      params: GetBusinessByUidParamsSchema,
      response: DeleteBusinessResponseSchema,
    },
  });
}
