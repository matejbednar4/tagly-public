import {
  GetAdvertiserTransactionsBody,
  GetAdvertiserTransactionsBodySchema,
  GetAdvertiserTransactionsResponse,
  GetAdvertiserTransactionsResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/transactions`. The advertiser's money history
 * (card deposits in, share spend out, refunds/promo/adjustments/referral
 * payouts), newest first, offset-paginated, with an optional `types` filter.
 * POST + body so it plugs into the shared `makeOffsetFetcher`/`PaginatedList`
 * convention. Authed (JWT).
 */
export function getAdvertiserTransactions({
  body,
  jwt,
}: {
  body: GetAdvertiserTransactionsBody;
  jwt: string;
}): ApiResponse<GetAdvertiserTransactionsResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/transactions",
    body,
    jwt,
    schemas: {
      body: GetAdvertiserTransactionsBodySchema,
      response: GetAdvertiserTransactionsResponseSchema,
    },
  });
}
