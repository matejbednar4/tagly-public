import {
  ShareUidParams,
  ShareUidParamsSchema,
  GetAdvertiserShareResponse,
  GetAdvertiserShareResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/shares/:uid`. One of the advertiser's shares by UID
 * (deep-linkable detail screen). Authed (JWT). Pure read.
 */
export function getShareByUid({
  params,
  jwt,
  signal,
  headers,
}: {
  params: ShareUidParams;
  jwt: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}): ApiResponse<GetAdvertiserShareResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/shares/:uid",
    params,
    jwt,
    signal,
    headers,
    schemas: {
      params: ShareUidParamsSchema,
      response: GetAdvertiserShareResponseSchema,
    },
  });
}
