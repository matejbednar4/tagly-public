import {
  AgreeWithPrivacyPolicyResponse,
  AgreeWithPrivacyPolicyResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/cross/privacy-policy/agree`. Twin of `agreeWithTos` for the
 * Privacy Policy (clears `shouldAgreeWithLatestPrivacyPolicy` on `GET /me`). No
 * body. Authed (JWT from either app). Exported via `@tagly/sdk/v2/crossApp`.
 */
export function agreeWithPrivacyPolicy({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AgreeWithPrivacyPolicyResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/cross/privacy-policy/agree",
    jwt,
    schemas: {
      response: AgreeWithPrivacyPolicyResponseSchema,
    },
  });
}
