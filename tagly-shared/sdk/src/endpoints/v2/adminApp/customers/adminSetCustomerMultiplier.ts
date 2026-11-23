import {
  AdminCustomerUidParams,
  AdminCustomerUidParamsSchema,
  AdminSetCustomerMultiplierBody,
  AdminSetCustomerMultiplierBodySchema,
  AdminSetCustomerMultiplierResponse,
  AdminSetCustomerMultiplierResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/customers/:uid/multiplier`. Absolute set of the
 * customer's rating multiplier in bps (server rejects out-of-bounds).
 * Returns the full `AdminCustomer`. Authed (admin JWT, SUPER).
 */
export function adminSetCustomerMultiplier({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminCustomerUidParams;
  body: AdminSetCustomerMultiplierBody;
}): ApiResponse<AdminSetCustomerMultiplierResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/customers/:uid/multiplier",
    params,
    jwt,
    body,
    schemas: {
      params: AdminCustomerUidParamsSchema,
      body: AdminSetCustomerMultiplierBodySchema,
      response: AdminSetCustomerMultiplierResponseSchema,
    },
  });
}
