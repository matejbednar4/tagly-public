import {
  GetShareOpportunityQuery,
  GetShareOpportunityResponse,
  GetShareOpportunityResponseSchema,
  GetShareOpportunityQuerySchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/share-opportunity`. Given the device location,
 * detects whether the customer is inside a shareable Tagly business (and, if a
 * live IG story already tags it, returns that story too). Authed (JWT). Resolves
 * `{ scenario: "none" | "inBusiness" | "inBusinessWithStory", … }`.
 */
export function getShareOpportunity({
  query,
  jwt,
}: {
  query: GetShareOpportunityQuery;
  jwt: string;
}): ApiResponse<GetShareOpportunityResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/share-opportunity",
    query,
    jwt,
    schemas: {
      query: GetShareOpportunityQuerySchema,
      response: GetShareOpportunityResponseSchema,
    },
  });
}
