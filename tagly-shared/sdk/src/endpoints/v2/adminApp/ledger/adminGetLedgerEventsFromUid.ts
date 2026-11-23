import {
  AdminLedgerEventsFromUidParams,
  AdminLedgerEventsFromUidParamsSchema,
  AdminLedgerEventsFromUidQuery,
  AdminLedgerEventsFromUidQuerySchema,
  AdminLedgerEventsFromUidResponse,
  AdminLedgerEventsFromUidResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/ledger-events/from/:uid`. Paginated, entity-wide money
 * trail for one account (customer / advertiser / business, resolved by uid
 * prefix). Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetLedgerEventsFromUid({
  params,
  query,
  jwt,
}: {
  params: AdminLedgerEventsFromUidParams;
  query: AdminLedgerEventsFromUidQuery;
  jwt: string;
}): ApiResponse<AdminLedgerEventsFromUidResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/ledger-events/from/:uid",
    params,
    query,
    jwt,
    schemas: {
      params: AdminLedgerEventsFromUidParamsSchema,
      query: AdminLedgerEventsFromUidQuerySchema,
      response: AdminLedgerEventsFromUidResponseSchema,
    },
  });
}
