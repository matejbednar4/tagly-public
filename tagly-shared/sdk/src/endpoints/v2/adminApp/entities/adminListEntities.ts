import {
  AdminListEntitiesQuery,
  AdminListEntitiesQuerySchema,
  AdminListEntitiesResponse,
  AdminListEntitiesResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/entities`. One entity type per call (customer / advertiser
 * / local / share), 10 per page, each fully hydrated into its admin detail DTO.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminListEntities({
  query,
  jwt,
}: {
  query: AdminListEntitiesQuery;
  jwt: string;
}): ApiResponse<AdminListEntitiesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/entities",
    query,
    jwt,
    schemas: {
      query: AdminListEntitiesQuerySchema,
      response: AdminListEntitiesResponseSchema,
    },
  });
}
