import {
  UpdateNameBody,
  UpdateNameBodySchema,
  UpdateNameResponse,
  UpdateNameResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/name`. Updates the logged-in customer's
 * display name (`fullName`). Authed (JWT).
 */
export function updateName({
  body,
  jwt,
}: {
  body: UpdateNameBody;
  jwt: string;
}): ApiResponse<UpdateNameResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/name",
    body,
    jwt,
    schemas: {
      body: UpdateNameBodySchema,
      response: UpdateNameResponseSchema,
    },
  });
}
