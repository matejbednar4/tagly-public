import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminGetBusinessQrStickersResponse,
  AdminGetBusinessQrStickersResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/businesses/:uid/stickers`. All QR stickers currently
 * hanging in a business, newest assignment first (the admin business-detail
 * "QR stickers" section). Authed (admin JWT, SUPER).
 */
export function adminGetBusinessQrStickers({
  jwt,
  params,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
}): ApiResponse<AdminGetBusinessQrStickersResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/businesses/:uid/stickers",
    params,
    jwt,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      response: AdminGetBusinessQrStickersResponseSchema,
    },
  });
}
