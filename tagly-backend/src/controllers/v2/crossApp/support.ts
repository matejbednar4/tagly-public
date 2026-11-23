import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import type {
  SubmitSupportBody,
  SubmitSupportResponse,
} from "@tagly/models/v2/crossApp";
import { sendEmail } from "../../../utils/email/sendEmail.js";
import { escapeHtml } from "../../../utils/formatting/escapeHtml.js";
import { headerOr } from "../../../utils/core/http/headerOr.js";
import { CONTACT } from "../../../constants/platform/CONTACT.js";
import prisma from "../../../prisma/prisma.js";
import { getEntityFromUid } from "../../../utils/core/uids/getEntityFromUid.js";

/**
 * `POST /v2/cross/support` — submit a support / help request (e.g. appeal a
 * ban). Authed by either app's JWT (mounted under the `/v2/cross` group). Emails
 * the message to the team's support inbox; nothing is persisted. Twin of
 * `submitFeedback`, routed to the support inbox (so `replyTo` lets the team reply
 * to the user by email) with an optional `context` origin tag for triage.
 *
 * The email carries the sender's `uid`, the optional origin `context`, and the
 * client context (app, platform, version) from the standard `X-App-*` headers, so
 * support can identify the user and where they hit the issue. The user-supplied
 * message is HTML-escaped before templating.
 */
export const submitSupport: RequestHandler = asyncHandler(async (req, res) => {
  const { message, context } = req.validatedBody as SubmitSupportBody;
  const { uid } = req.user;

  // Resolve the sender's email so the team can reply directly (Reply-To).
  const entity = getEntityFromUid(uid);
  const replyTo =
    entity === "CUSTOMER"
      ? (
          await prisma.customer.findUnique({
            where: { uid },
            select: { email: true },
          })
        )?.email
      : entity === "ADVERTISER"
        ? (
            await prisma.advertiser.findUnique({
              where: { uid },
              select: { email: true },
            })
          )?.email
        : undefined;

  const appClient = headerOr(req.headers["x-app-client"], "unknown");
  const appPlatform = headerOr(req.headers["x-app-platform"], "unknown");
  const appVersion = headerOr(req.headers["x-app-version"], "unknown");

  const bodyHtml = [
    `<p><strong>From:</strong> ${escapeHtml(uid)}</p>`,
    context ? `<p><strong>Context:</strong> ${escapeHtml(context)}</p>` : "",
    `<p><strong>App:</strong> ${escapeHtml(appClient)} · ${escapeHtml(
      appPlatform,
    )} · v${escapeHtml(appVersion)}</p>`,
    `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  ].join("");

  await sendEmail({
    target: CONTACT.SUPPORT_EMAIL,
    subject: "New support request",
    title: "New support request",
    bodyHtml,
    replyTo,
  });

  res
    .status(201)
    .json({ message: "Support request received" } satisfies SubmitSupportResponse);
});
