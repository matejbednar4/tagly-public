import {
  UpdateLanguageBody,
  UpdateLanguageBodySchema,
  UpdateLanguageResponse,
  UpdateLanguageResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/update/language`. Set the advertiser's preferred
 * language (`en` | `cs`) for server-sent copy (transactional push + email).
 * Authed (JWT).
 */
export function updateLanguage({
  body,
  jwt,
}: {
  body: UpdateLanguageBody;
  jwt: string;
}): ApiResponse<UpdateLanguageResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/update/language",
    body,
    jwt,
    schemas: {
      body: UpdateLanguageBodySchema,
      response: UpdateLanguageResponseSchema,
    },
  });
}
