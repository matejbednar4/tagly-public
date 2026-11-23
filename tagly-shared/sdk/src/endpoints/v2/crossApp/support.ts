import {
  SubmitSupportBody,
  SubmitSupportBodySchema,
  SubmitSupportResponse,
  SubmitSupportResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/cross/support`. Submits a support / help request (e.g. a ban
 * appeal); the backend emails it to the support inbox and the team replies by
 * email. Authed (JWT from either app). Exported via `@tagly/sdk/v2/crossApp`.
 */
export function submitSupport({
  body,
  jwt,
}: {
  body: SubmitSupportBody;
  jwt: string;
}): ApiResponse<SubmitSupportResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/cross/support",
    body,
    jwt,
    schemas: {
      body: SubmitSupportBodySchema,
      response: SubmitSupportResponseSchema,
    },
  });
}
