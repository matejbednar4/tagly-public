import {
  AdminSendBlastBody,
  AdminSendBlastBodySchema,
  AdminSendBlastResponse,
  AdminSendBlastResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/notifications/blast`. Queue a one-off blast (push
 * and/or email) to the selected audiences. `audience: "EVERYONE"` bypasses the
 * promo opt-out and is for operational service announcements only. The `slug`
 * makes the blast trackable: push opens land in PostHog as `push_opened` with
 * slug `admin.blast:<slug>`; the email leg carries a `blast` Resend
 * tag. Authed (admin JWT, SUPER).
 */
export function adminSendBlast({
  jwt,
  body,
}: {
  jwt: string;
  body: AdminSendBlastBody;
}): ApiResponse<AdminSendBlastResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/notifications/blast",
    jwt,
    body,
    schemas: {
      body: AdminSendBlastBodySchema,
      response: AdminSendBlastResponseSchema,
    },
  });
}
