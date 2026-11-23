import {
  GetInstagramSnapshotStatusResponse,
  GetInstagramSnapshotStatusResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/instagram/snapshot-status`. Lightweight poll while
 * waiting on an audience snapshot queued by `/me/instagram/refresh`. Authed (JWT).
 */
export function getInstagramSnapshotStatus({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetInstagramSnapshotStatusResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/instagram/snapshot-status",
    jwt,
    schemas: {
      response: GetInstagramSnapshotStatusResponseSchema,
    },
  });
}
