import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import type {
  SubmitFeedbackBody,
  SubmitFeedbackResponse,
} from "@tagly/models/v2/crossApp";
import { sendEmail } from "../../../utils/email/sendEmail.js";
import { escapeHtml } from "../../../utils/formatting/escapeHtml.js";
import { headerOr } from "../../../utils/core/http/headerOr.js";
import { CONTACT } from "../../../constants/platform/CONTACT.js";
import prisma from "../../../prisma/prisma.js";
import { getEntityFromUid } from "../../../utils/core/uids/getEntityFromUid.js";

/**
 * `POST /v2/cross/feedback` — submit in-app feedback / a feature request. Authed
 * by either app's JWT (mounted under the `/v2/cross` group). Emails the message
 * to the team's feedback inbox; nothing is persisted (the chosen delivery is
 * email-only — see v2.0.0.md).
 *
 * The email carries the sender's `uid` plus the client context (app, platform,
 * version) read from the standard `X-App-*` headers every app build sends — so
 * the team can identify the user and reproduce against the right build. The
 * user-supplied message is HTML-escaped before templating.
 */
export const submitFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const { message } = req.validatedBody as SubmitFeedbackBody;
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
    `<p><strong>App:</strong> ${escapeHtml(appClient)} · ${escapeHtml(
      appPlatform,
    )} · v${escapeHtml(appVersion)}</p>`,
    `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  ].join("");

  await sendEmail({
    target: CONTACT.FEEDBACK_EMAIL,
    subject: "New app feedback",
    title: "New app feedback",
    bodyHtml,
    replyTo,
  });

  res
    .status(201)
    .json({ message: "Feedback received" } satisfies SubmitFeedbackResponse);
});
