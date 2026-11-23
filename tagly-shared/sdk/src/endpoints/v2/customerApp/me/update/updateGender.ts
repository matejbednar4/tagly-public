import {
  UpdateGenderBody,
  UpdateGenderBodySchema,
  UpdateGenderResponse,
  UpdateGenderResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/gender`. Updates gender; a concrete value is
 * gated by a 90-day cooldown (403 if too soon), clearing to `UNSPECIFIED` is
 * always allowed. Authed (JWT).
 */
export function updateGender({
  body,
  jwt,
}: {
  body: UpdateGenderBody;
  jwt: string;
}): ApiResponse<UpdateGenderResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/gender",
    body,
    jwt,
    schemas: {
      body: UpdateGenderBodySchema,
      response: UpdateGenderResponseSchema,
    },
  });
}
