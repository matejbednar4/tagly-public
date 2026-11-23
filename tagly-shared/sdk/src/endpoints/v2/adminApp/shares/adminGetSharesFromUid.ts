import {
  AdminSharesFromUidParams,
  AdminSharesFromUidParamsSchema,
  AdminSharesFromUidQuery,
  AdminSharesFromUidQuerySchema,
  AdminSharesFromUidResponse,
  AdminSharesFromUidResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/shares/from/:uid`. Paginated shares for one entity
 * (customer / advertiser / business), resolved by uid prefix. Authed (admin
 * JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetSharesFromUid({
  params,
  query,
  jwt,
}: {
  params: AdminSharesFromUidParams;
  query: AdminSharesFromUidQuery;
  jwt: string;
}): ApiResponse<AdminSharesFromUidResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/shares/from/:uid",
    params,
    query,
    jwt,
    schemas: {
      params: AdminSharesFromUidParamsSchema,
      query: AdminSharesFromUidQuerySchema,
      response: AdminSharesFromUidResponseSchema,
    },
  });
}
