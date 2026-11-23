import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import prisma from "../../../prisma/prisma.js";
import { verifyUnsubscribeToken } from "../../../utils/email/unsubscribeToken.js";
import { captureServerEvent } from "../../../utils/core/errors/captureServerEvent.js";
import { resolveRecipientAnalyticsId } from "../../../utils/notifications/resolveRecipientAnalyticsId.js";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";

/**
 * One-click email unsubscribe handler.
 *
 * PERMANENT surface (lives in `controllers/webhooks/`, mounted directly in
 * `app.ts`): the URL is baked into every promo email ever sent (footer link +
 * `List-Unsubscribe` headers) and the tokens deliberately never expire
 * (CAN-SPAM), so the path must keep resolving forever — through every
 * cutover. The callers are humans, mail
 * clients, and Gmail/Yahoo's one-click POST servers — never a versioned app
 * client. Do NOT move this back under a versioned route tree; a dead
 * unsubscribe endpoint converts opt-outs into spam reports and burns the
 * sender-domain reputation (v2-review E-medium, relocated 2026-08-02).
 *
 * Served on TWO frozen paths (both mounted in `app.ts`, same handler):
 * - `/webhooks/email/unsubscribe` — canonical, baked into all mail sent from
 *   2026-08-02 on (`buildUnsubscribeUrl`).
 * - `/public/unsubscribe` — legacy; every link/header sent before the rename
 *   points here. Additive migration: keep forever, never remove.
 *
 * GET ?token=<signed-jwt>   — the human path (footer link; returns the
 *   branded confirmation page).
 * POST ?token=<signed-jwt>  — the RFC 8058 one-click path: mail providers
 *   POST here from their native "Unsubscribe" button (the
 *   `List-Unsubscribe`/`List-Unsubscribe-Post` headers stamped in `sendEmail`).
 *   Same handler: the token rides the query string, the form body is ignored,
 *   and the flow is idempotent; providers ignore the HTML response body.
 *
 * Token payload variants:
 * - { kind: "customer", customerId }               → Customer.promoNotificationsEnabled = false
 * - { kind: "advertiser", advertiserId }            → Advertiser.promoNotificationsEnabled = false
 * - { kind: "pendingCustomer", pendingCustomerId }  → PendingCustomer.promoNotificationsEnabled = false
 * - { kind: "pendingAdvertiser", ... }              → PendingAdvertiserAccount.promoNotificationsEnabled = false
 *
 * Returns a simple HTML confirmation page.
 * Always returns 200 — even on invalid/expired tokens (user-facing endpoint).
 */
export const unsubscribeEmail: RequestHandler = asyncHandler(
  async (req, res) => {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.status(200).send(buildHtml("Invalid link", invalidHtml()));
    }

    const payload = verifyUnsubscribeToken(token);

    if (!payload) {
      return res.status(200).send(buildHtml("Invalid link", invalidHtml()));
    }

    if (payload.kind === "customer") {
      await prisma.customer.updateMany({
        where: { id: payload.customerId },
        data: { promoNotificationsEnabled: false },
      });
    } else if (payload.kind === "advertiser") {
      await prisma.advertiser.updateMany({
        where: { id: payload.advertiserId },
        data: { promoNotificationsEnabled: false },
      });
    } else if (payload.kind === "pendingCustomer") {
      await prisma.pendingCustomer.updateMany({
        where: { id: payload.pendingCustomerId },
        data: { promoNotificationsEnabled: false },
      });
    } else if (payload.kind === "pendingAdvertiser") {
      await prisma.pendingAdvertiserAccount.updateMany({
        where: { id: payload.pendingAdvertiserId },
        data: { promoNotificationsEnabled: false },
      });
    }

    // Attribute the opt-out to the email whose link was clicked: promo
    // unsubscribe tokens carry the step's slug (absent on links sent before
    // slug stamping). Pairs with promo_notification_sent for per-step
    // unsubscribe rates.
    const attribution =
      payload.kind === "customer"
        ? { target: "CUSTOMER", id: payload.customerId }
        : payload.kind === "advertiser"
          ? { target: "ADVERTISER", id: payload.advertiserId }
          : payload.kind === "pendingCustomer"
            ? { target: "PENDING_CUSTOMER", id: payload.pendingCustomerId }
            : { target: "PENDING_ADVERTISER", id: payload.pendingAdvertiserId };
    captureServerEvent({
      event: "email_unsubscribed",
      distinctId: await resolveRecipientAnalyticsId(
        attribution.target as Parameters<typeof resolveRecipientAnalyticsId>[0],
        attribution.id,
      ),
      service: "api",
      properties: { slug: payload.slug ?? null, target: attribution.target },
    });

    return res.status(200).send(buildHtml("Unsubscribed", successHtml()));
  },
);

/**
 * Standalone confirmation page in the marketing-email look — the same
 * `EMAIL_BRAND` tokens as `buildMarketingEmailHTML` (cream canvas, ink
 * wordmark, floating white card with the warm shadow, Playfair headline), so
 * the click-through from a redesigned email doesn't land on off-brand chrome.
 * Static strings only — nothing user-supplied is interpolated.
 */
function buildHtml(title: string, body: string): string {
  const { COLOR, FONT, ASSETS, LINKS, SHADOW } = EMAIL_BRAND;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · Tagly</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @font-face {
      font-family: "Playfair Display";
      src: url("${ASSETS.FONT_PLAYFAIR_BOLD_WOFF2}") format("woff2");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    body {
      font-family: ${FONT.BODY};
      background: ${COLOR.CANVAS};
      color: ${COLOR.INK};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .wrap { width: 100%; max-width: 440px; text-align: center; }
    .logo { display: inline-block; margin-bottom: 24px; }
    .logo img { width: 96px; height: auto; border: 0; }
    .card {
      background: ${COLOR.SURFACE};
      border-radius: 8px;
      box-shadow: ${SHADOW.CARD};
      padding: 32px 28px;
    }
    h1 {
      font-family: ${FONT.HEADING};
      font-size: 24px;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 10px;
    }
    p { font-size: 15px; line-height: 1.6; color: ${COLOR.TEXT_SECONDARY}; }
    .footer { margin-top: 20px; font-size: 12px; }
    .footer a { color: ${COLOR.TEXT_TERTIARY}; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="logo" href="${LINKS.WEBSITE}" target="_blank" rel="noopener noreferrer">
      <img src="${ASSETS.LOGO_INK_URL}" alt="Tagly" width="160" />
    </a>
    <div class="card">
      ${body}
    </div>
    <div class="footer">
      <a href="${LINKS.WEBSITE}" target="_blank" rel="noopener noreferrer">taglyapp.com</a>
    </div>
  </div>
</body>
</html>`;
}

function successHtml(): string {
  return `
    <h1>You're unsubscribed</h1>
    <p>You won't get any more marketing emails from Tagly.<br/>
    You can turn them back on anytime in the app settings.</p>`;
}

function invalidHtml(): string {
  return `
    <h1>Invalid link</h1>
    <p>This unsubscribe link isn't valid.<br/>
    You can manage all notifications in the Tagly app settings.</p>`;
}
