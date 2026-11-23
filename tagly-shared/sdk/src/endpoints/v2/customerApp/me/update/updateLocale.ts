import {
  UpdateLocaleBody,
  UpdateLocaleBodySchema,
  UpdateLocaleResponse,
  UpdateLocaleResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/locale`. Self-serve region correction (US↔CZ)
 * for a mis-derived locale, before any Stripe Connect account exists. Rejected
 * (409) if a Connect account was already created (country locked → contact
 * support). Authed (JWT).
 */
export function updateLocale({
  body,
  jwt,
}: {
  body: UpdateLocaleBody;
  jwt: string;
}): ApiResponse<UpdateLocaleResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/locale",
    body,
    jwt,
    schemas: {
      body: UpdateLocaleBodySchema,
      response: UpdateLocaleResponseSchema,
    },
  });
}
