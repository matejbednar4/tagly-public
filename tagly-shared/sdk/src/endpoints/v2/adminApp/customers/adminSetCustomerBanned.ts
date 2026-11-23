import {
  AdminCustomerUidParams,
  AdminCustomerUidParamsSchema,
  AdminSetCustomerBannedBody,
  AdminSetCustomerBannedBodySchema,
  AdminSetCustomerBannedResponse,
  AdminSetCustomerBannedResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/customers/:uid/banned`. Ban (with a required reason,
 * emailed to the customer + IG blocklisted) or unban a customer. Returns the
 * full `AdminCustomer`. Authed (admin JWT, SUPER).
 */
export function adminSetCustomerBanned({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminCustomerUidParams;
  body: AdminSetCustomerBannedBody;
}): ApiResponse<AdminSetCustomerBannedResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/customers/:uid/banned",
    params,
    jwt,
    body,
    schemas: {
      params: AdminCustomerUidParamsSchema,
      body: AdminSetCustomerBannedBodySchema,
      response: AdminSetCustomerBannedResponseSchema,
    },
  });
}
