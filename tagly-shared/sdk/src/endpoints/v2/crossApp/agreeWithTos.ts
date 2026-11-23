import {
  AgreeWithTosResponse,
  AgreeWithTosResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/cross/terms-of-service/agree`. Records the authed user's
 * agreement to the latest Terms of Service (stamps the agreed-at timestamp,
 * clearing the `shouldAgreeWithLatestTos` gate on `GET /me`). No body. Authed
 * (JWT from either app). Exported via `@tagly/sdk/v2/crossApp`.
 */
export function agreeWithTos({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AgreeWithTosResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/cross/terms-of-service/agree",
    jwt,
    schemas: {
      response: AgreeWithTosResponseSchema,
    },
  });
}
