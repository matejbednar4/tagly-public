import {
  ShareUidParams,
  ShareUidParamsSchema,
  ShareAssessmentBody,
  ShareAssessmentBodySchema,
  ShareAssessmentResponse,
  ShareAssessmentResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/shares/:uid/assessment`. Rate OR report one of the
 * advertiser's shares (mutually exclusive, discriminated by `body.kind`).
 * Returns the freshly-updated share so the client can swap it into any list.
 * Authed (JWT).
 */
export function submitShareAssessment({
  params,
  body,
  jwt,
}: {
  params: ShareUidParams;
  body: ShareAssessmentBody;
  jwt: string;
}): ApiResponse<ShareAssessmentResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/shares/:uid/assessment",
    params,
    body,
    jwt,
    schemas: {
      params: ShareUidParamsSchema,
      body: ShareAssessmentBodySchema,
      response: ShareAssessmentResponseSchema,
    },
  });
}
