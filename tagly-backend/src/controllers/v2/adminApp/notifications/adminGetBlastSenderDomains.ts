/**
 * Lists the sending identities a blast can use
 * (`GET /v2/admin/notifications/sender-domains`), read LIVE from Resend so the
 * compose UI never offers a domain that can't actually send. The default (no
 * override) is the standard marketing sender; each verified domain sends as
 * `notifications@<domain>` when picked (see `sendEmailNotification`).
 */

import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { CONTACT } from "../../../../constants/platform/CONTACT.js";
import { getVerifiedResendDomainsOrThrow } from "../../../../utils/notifications/getVerifiedResendDomainsOrThrow.js";
import type { AdminGetBlastSenderDomainsResponse } from "@tagly/models/v2/adminApp";

export const adminGetBlastSenderDomains: RequestHandler = asyncHandler(
  async (_req, res) => {
    const domains = await getVerifiedResendDomainsOrThrow();

    res.status(200).json({
      message: "Sender domains fetched",
      defaultFromEmail: CONTACT.MARKETING_FROM_EMAIL,
      domains: domains.map((domain) => ({
        domain,
        fromEmail: `notifications@${domain}`,
      })),
    } satisfies AdminGetBlastSenderDomainsResponse);
  },
);
