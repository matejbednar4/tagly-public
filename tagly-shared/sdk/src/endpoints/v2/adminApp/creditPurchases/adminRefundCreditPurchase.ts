import {
  AdminCreditPurchaseUidParams,
  AdminCreditPurchaseUidParamsSchema,
  AdminRefundCreditPurchaseBody,
  AdminRefundCreditPurchaseBodySchema,
  AdminRefundCreditPurchaseResponse,
  AdminRefundCreditPurchaseResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/credit-purchases/:uid/refund`. Refund (part of) a
 * completed credit purchase back to the advertiser's card: locks the amount
 * out of available budget, issues the Stripe refund, and the refund webhook
 * books the final ledger event + status flip. PAYG charges are
 * non-refundable; the amount is capped at the not-yet-refunded remainder and
 * the advertiser's available budget. Authed (admin JWT, SUPER). Exported via
 * `@tagly/sdk/v2/adminApp`.
 */
export function adminRefundCreditPurchase({
  params,
  body,
  jwt,
}: {
  params: AdminCreditPurchaseUidParams;
  body: AdminRefundCreditPurchaseBody;
  jwt: string;
}): ApiResponse<AdminRefundCreditPurchaseResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/credit-purchases/:uid/refund",
    params,
    body,
    jwt,
    schemas: {
      params: AdminCreditPurchaseUidParamsSchema,
      body: AdminRefundCreditPurchaseBodySchema,
      response: AdminRefundCreditPurchaseResponseSchema,
    },
  });
}
