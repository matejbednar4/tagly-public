import {
  SubmitFeedbackBody,
  SubmitFeedbackBodySchema,
  SubmitFeedbackResponse,
  SubmitFeedbackResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/cross/feedback`. Submits in-app feedback / a feature request;
 * the backend emails it to the team. Authed (JWT from either app). Exported via
 * `@tagly/sdk/v2/crossApp`.
 */
export function submitFeedback({
  body,
  jwt,
}: {
  body: SubmitFeedbackBody;
  jwt: string;
}): ApiResponse<SubmitFeedbackResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/cross/feedback",
    body,
    jwt,
    schemas: {
      body: SubmitFeedbackBodySchema,
      response: SubmitFeedbackResponseSchema,
    },
  });
}
