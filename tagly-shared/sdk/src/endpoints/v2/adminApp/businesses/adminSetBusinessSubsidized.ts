import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminSetBusinessSubsidizedBody,
  AdminSetBusinessSubsidizedBodySchema,
  AdminSetBusinessSubsidizedResponse,
  AdminSetBusinessSubsidizedResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/businesses/:uid/subsidized`. Open (`true`) / close
 * (`false`) the business's SubsidizationPeriod (ACTIVE + unowned only).
 * Returns the full `AdminBusiness`. Authed (admin JWT, SUPER).
 */
export function adminSetBusinessSubsidized({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminSetBusinessSubsidizedBody;
}): ApiResponse<AdminSetBusinessSubsidizedResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/businesses/:uid/subsidized",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminSetBusinessSubsidizedBodySchema,
      response: AdminSetBusinessSubsidizedResponseSchema,
    },
  });
}
