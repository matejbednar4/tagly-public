import {
  GetCustomerTransactionsBody,
  GetCustomerTransactionsBodySchema,
  GetCustomerTransactionsResponse,
  GetCustomerTransactionsResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/transactions`. The customer's money history (earnings
 * in + withdrawals out), newest first, offset-paginated, with an optional `types`
 * filter. POST + body so it plugs into the shared `makeOffsetFetcher`/
 * `PaginatedList` convention. Authed (JWT).
 */
export function getCustomerTransactions({
  body,
  jwt,
}: {
  body: GetCustomerTransactionsBody;
  jwt: string;
}): ApiResponse<GetCustomerTransactionsResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/transactions",
    body,
    jwt,
    schemas: {
      body: GetCustomerTransactionsBodySchema,
      response: GetCustomerTransactionsResponseSchema,
    },
  });
}
