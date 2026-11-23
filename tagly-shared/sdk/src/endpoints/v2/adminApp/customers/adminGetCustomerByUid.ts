import {
  AdminCustomerUidParams,
  AdminCustomerUidParamsSchema,
  AdminGetCustomerResponse,
  AdminGetCustomerResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/customers/:uid`. One customer, full admin view.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetCustomerByUid({
  params,
  jwt,
}: {
  params: AdminCustomerUidParams;
  jwt: string;
}): ApiResponse<AdminGetCustomerResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/customers/:uid",
    params,
    jwt,
    schemas: {
      params: AdminCustomerUidParamsSchema,
      response: AdminGetCustomerResponseSchema,
    },
  });
}
