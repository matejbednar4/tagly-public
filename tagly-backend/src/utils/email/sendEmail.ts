import type { SupportedLanguage } from "@tagly/models/shared";
import { createCustomError } from "../core/errors/createCustomError.js";
import { resendClient } from "../clients/resend.js";
import { envVariables } from "../../environment/envVariables.js";
import { EMAIL_ENV_TAG_NAME } from "./promoEmailTags.js";
import { CONTACT } from "../../constants/platform/CONTACT.js";
import { buildMarketingEmailHTML } from "./templates/buildMarketingEmailHTML.js";
import { buildTransactionalEmailHTML } from "./templates/buildTransactionalEmailHTML.js";
import { buildPlainTextEmail } from "./templates/buildPlainTextEmail.js";

/**
 * The canonical **product** email sender: wraps the body in one of the two
 * branded templates and **throws** on failure (callers surface the error to
 * the user).
 *
 * Two templates, one shared chrome (see `templates/`):
 *  - `transactional` (default) — `buildTransactionalEmailHTML`, the plain
 *    "note" look. 1:1 mail: OTP, payouts, account/state changes.
 *  - `marketing` — `buildMarketingEmailHTML`, the expressive "postcard" card.
 *    Bulk sends: promo events + admin blasts.
 * When `template` isn't passed it's derived from `unsubscribeUrl`: bulk mail
 * is exactly the mail that carries a one-click unsubscribe.
 *
 * `fromEmail` selects the sending identity / **reputation stream** — defaults to
 * the PROTECTED transactional sender (OTP + transactional); pass
 * `CONTACT.MARKETING_FROM_EMAIL` for the BULK stream (marketing / admin
 * broadcast) so its complaints can't drag down critical mail.
 *
 * Not to be merged with `utils/email/sendTeamAlertEmail.ts` (the ops
 * alert sender): that one is template-less, addressed to the team, and **never
 * throws** (it runs after money-moving transactions commit). They share only
 * the permanent `resendClient`, which is the intended canonical overlap.
 */
export const sendEmail = async ({
  target,
  subject,
  bodyHtml,
  preheader,
  title,
  unsubscribeUrl,
  template,
  cta,
  lang = "en",
  fromEmail = CONTACT.NOTIFICATIONS_FROM_EMAIL,
  replyTo = CONTACT.SUPPORT_EMAIL,
  tags,
  idempotencyKey,
}: {
  target: string;
  subject: string;
  bodyHtml: string;
  preheader?: string;
  title?: string;
  /** When provided, an unsubscribe link is added to the email footer. Pass for promo emails only. */
  unsubscribeUrl?: string;
  /** Reply-To override; defaults to the support inbox. Team-inbox mail (support/feedback) passes the sender's address so the team can reply directly. */
  replyTo?: string;
  /**
   * When provided, the email ends with the standard CTA button opening this
   * app (the only destination an email CTA may have). Driven by the catalog
   * `showCta` flag via the notifications worker.
   */
  cta?: { app: "customer" | "advertiser" };
  /**
   * Which visual template wraps the body. Defaults by the unsubscribe rule:
   * `unsubscribeUrl` present → `marketing`, else `transactional`.
   */
  template?: "transactional" | "marketing";
  /** Recipient's language — localizes the template chrome (footer, sign-off). */
  lang?: SupportedLanguage;
  /**
   * Sending identity (reputation stream). Defaults to the protected
   * transactional sender; pass `CONTACT.MARKETING_FROM_EMAIL` for bulk mail.
   */
  fromEmail?: string;
  /**
   * Resend analytics tags — labels on the send, visible in the Resend
   * dashboard (names/values restricted to `[A-Za-z0-9_-]`). Promo sends pass
   * `buildPromoEmailTags`; leave unset elsewhere. The `env` tag is stamped
   * here on EVERY send regardless — don't pass it (see promoEmailTags.ts).
   */
  tags?: { name: string; value: string }[];
  /**
   * Resend `Idempotency-Key` (stable per logical send, e.g. the notification
   * queue-row id). Makes a retry after a sent-but-errored attempt a server-side
   * no-op instead of a duplicate email. Resend stores keys ~24h — retries of
   * the same job land well inside that.
   */
  idempotencyKey?: string;
}) => {
  const resolvedTemplate =
    template ?? (unsubscribeUrl ? "marketing" : "transactional");

  const templateOptions = {
    bodyHtml,
    title: title ?? subject,
    preheader: preheader ?? subject,
    unsubscribeUrl,
    cta,
    lang,
  };

  // Hard cap on the Resend call. The SDK sets no request timeout, so a stuck
  // socket otherwise hangs the caller forever — in the notifications worker
  // that froze the whole delivery loop (the per-job deadline there is the
  // second line of defence; this is the first). The raced-out request keeps
  // running detached; the per-send Idempotency-Key (promo) / Resend-side dedup
  // means a retry can't double-deliver. Single-use constant, so it lives here.
  const RESEND_SEND_TIMEOUT_MS = 15_000;

  try {
    const send = resendClient.emails.send(
      {
        from: `Tagly <${fromEmail}>`,
        to: target,
        subject,
        replyTo,
        // Every send carries its environment. The consuming webhook was
        // removed (2026-08-05), but the tag stays: Resend webhooks are
        // account-scoped (every endpoint receives every env's events,
        // E104/E251), so any future webhook needs this tag on all mail
        // already in flight to filter by env. See promoEmailTags.ts.
        tags: [
          ...(tags ?? []),
          { name: EMAIL_ENV_TAG_NAME, value: envVariables.APP_STAGE },
        ],
        // RFC 8058 one-click unsubscribe headers — exactly on the mail that
        // carries an unsubscribe link (promo). Gmail/Yahoo require these on
        // bulk senders and surface their native "Unsubscribe" button from
        // them; the provider POSTs to the URL (the POST twin of the permanent
        // /webhooks/email/unsubscribe mount — legacy /public/unsubscribe keeps
        // serving older mail), so the footer link stays for humans and the
        // header serves the machines.
        headers: unsubscribeUrl
          ? {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
        html:
          resolvedTemplate === "marketing"
            ? buildMarketingEmailHTML(templateOptions)
            : buildTransactionalEmailHTML(templateOptions),
        // Every send is multipart. An HTML-only message carries a spam-score
        // penalty at basically every consumer provider (iCloud especially) and
        // is blank in text-only clients. Generated from the same
        // `templateOptions`, so the two parts can never disagree.
        text: buildPlainTextEmail({
          ...templateOptions,
          template: resolvedTemplate,
        }),
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    let deadline: NodeJS.Timeout | undefined;
    const { error } = await Promise.race([
      send,
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () =>
            reject(
              new Error(
                `Resend send exceeded ${RESEND_SEND_TIMEOUT_MS}ms`,
              ),
            ),
          RESEND_SEND_TIMEOUT_MS,
        );
      }),
    ]).finally(() => clearTimeout(deadline));

    if (error) throw new Error(error.message);
  } catch (err) {
    // Keep the client-facing message clean but ride the root cause to the
    // tracker — "Failed to send email" alone is undebuggable.
    throw createCustomError(5782, "Failed to send email", {
      status: 500,
      cause: err,
    });
  }
};
