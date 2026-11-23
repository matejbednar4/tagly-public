import {
  UpdateLanguageBody,
  UpdateLanguageBodySchema,
  UpdateLanguageResponse,
  UpdateLanguageResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/language`. Set the customer's preferred
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
    path: "/v2/customers/me/update/language",
    body,
    jwt,
    schemas: {
      body: UpdateLanguageBodySchema,
      response: UpdateLanguageResponseSchema,
    },
  });
}
