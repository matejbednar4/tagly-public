import {
  AdminAdvertiserUidParams,
  AdminAdvertiserUidParamsSchema,
  AdminAssignPromotionalCreditBody,
  AdminAssignPromotionalCreditBodySchema,
  AdminAssignPromotionalCreditResponse,
  AdminAssignPromotionalCreditResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/advertisers/:uid/promotional-credit`. Gift an
 * advertiser promotional credits from the platform's unassigned Stripe
 * balance. Capped per request, idempotent per advertiser per hour (a repeat
 * within the hour 409s). Authed (admin JWT, SUPER). Exported via
 * `@tagly/sdk/v2/adminApp`.
 */
export function adminAssignPromotionalCredit({
  params,
  body,
  jwt,
}: {
  params: AdminAdvertiserUidParams;
  body: AdminAssignPromotionalCreditBody;
  jwt: string;
}): ApiResponse<AdminAssignPromotionalCreditResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/advertisers/:uid/promotional-credit",
    params,
    body,
    jwt,
    schemas: {
      params: AdminAdvertiserUidParamsSchema,
      body: AdminAssignPromotionalCreditBodySchema,
      response: AdminAssignPromotionalCreditResponseSchema,
    },
  });
}
