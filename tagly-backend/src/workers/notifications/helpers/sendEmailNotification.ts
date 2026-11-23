import { createCustomError } from "../../../utils/core/errors/createCustomError.js";
import {
  AnyEventSlug,
  notificationEvents,
  pickEventTemplate,
} from "../../../constants/catalogs/notifications/notificationRegistry.js";
import { sendEmail } from "../../../utils/email/sendEmail.js";
import { buildUnsubscribeUrl } from "../../../utils/email/unsubscribeToken.js";
import { buildPromoEmailTags } from "../../../utils/email/promoEmailTags.js";
import { CONTACT } from "../../../constants/platform/CONTACT.js";
import type { AccountType } from "../../../generated/prisma/client.js";
import type { SupportedLanguage } from "@tagly/models/shared";

/**
 * Render a queued notification's email template and send it. Owns the whole
 * email assembly — INCLUDING the unsubscribe footer and template choice: every
 * BULK send (promo events + admin blasts) carries a one-click unsubscribe and
 * the marketing "ink masthead" template; 1:1 transactional mail carries
 * neither. That's decided here from the event's own `notificationType`, not
 * threaded in by the caller.
 */
export async function sendEmailNotification(params: {
  to: string;
  target: AccountType;
  recipientId: number;
  /** Opaque analytics reference (uid / TARGET:id) for the Resend tag. */
  analyticsId: string;
  eventSlug: string;
  payload: unknown;
  /** Recipient's resolved language. Resolved once per job upstream. */
  lang: SupportedLanguage;
  /** Stable per-job Resend idempotency key (dedupes retries server-side). */
  idempotencyKey?: string;
}) {
  const { to, target, recipientId, analyticsId, eventSlug, payload, lang, idempotencyKey } =
    params;

  const slug = eventSlug as AnyEventSlug;
  const event = notificationEvents[slug];
  if (!event) {
    // 8010–8012: email-render permanent failures (worker 8xxx block).
    throw createCustomError(
      8010,
      `Unknown notification event slug for email: ${eventSlug}`,
      { permanent: true },
    );
  }

  const template = pickEventTemplate(slug, lang).email;
  if (!template) {
    throw createCustomError(
      8011,
      `No email template configured for event: ${eventSlug}`,
      { permanent: true },
    );
  }

  const data = payload as any;

  const bodyHtml = template.html(data);
  const title = template.title ? template.title(data) : undefined;
  const preheader = template.preheader ? template.preheader(data) : undefined;
  const subject =
    typeof template.subject === "function"
      ? template.subject(data)
      : template.subject;

  if (!bodyHtml) {
    throw createCustomError(
      8012,
      `Email template for event ${eventSlug} produced empty body`,
      { permanent: true },
    );
  }

  // One-click unsubscribe rides every BULK send: promo events (marketing —
  // legally required) and ALL admin blasts. EVERYONE-audience blasts include
  // it purely for deliverability: an identical mass send without an
  // unsubscribe turns "stop this" intent into "Report spam" clicks, which is
  // the one signal that genuinely burns the sender domain. The link opts the
  // account out of MARKETING (promoNotificationsEnabled = false) — a rare
  // future operational notice may still arrive, which is the standard
  // service-mail carve-out. Only 1:1 transactional mail goes without.
  const isPromo = event.notificationType === "promo";

  // Reputation stream: promo + admin are one-to-many BULK sends → the bulk
  // sender; transactional is 1:1 → the protected sender. Note the two admin
  // classifications diverge on purpose: admin is bulk (isolated sender) but NOT
  // marketing (no unsubscribe).
  const isAdmin = event.notificationType === "admin";
  const isBulk = isPromo || isAdmin;

  // Per-blast Resend tag: lets the dashboard filter a blast's delivery /
  // bounce / complaint numbers by its admin-chosen slug. Schema-enforced
  // kebab-case, but sanitize anyway — the tag alphabet is [A-Za-z0-9_-].
  const blastSlug =
    isAdmin && typeof data?.blastSlug === "string"
      ? data.blastSlug.replace(/[^A-Za-z0-9_-]/g, "_")
      : undefined;

  // Blast From identity: the payload's optional `senderDomain` override
  // (verified against `resend.domains.list()` at enqueue time in
  // `adminSendBlast`) sends as `notifications@<domain>`; otherwise the bulk
  // MARKETING stream. The shape guard doubles as a safety net against a
  // malformed payload ever composing a garbage address.
  const senderDomain =
    isAdmin &&
    typeof data?.senderDomain === "string" &&
    /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(data.senderDomain)
      ? data.senderDomain
      : undefined;
  const blastFromEmail = isAdmin
    ? senderDomain
      ? `notifications@${senderDomain}`
      : CONTACT.MARKETING_FROM_EMAIL
    : undefined;

  // Events opted in via `showCta` end with the standard open-the-app CTA
  // button, targeting the app the slug audience prefix names (`a.`/`pa.` →
  // advertiser, `c.`/`pc.` → customer). Email CTAs never point anywhere else.
  // NOTE: the `pa.` test is kept deliberately even though no `pa.` slug exists
  // today (the pending-advertiser sequence was removed 2026-08-09 as
  // unreachable). A bare startsWith("a.") does NOT match "pa.…", so without
  // this a re-added pending-advertiser slug would silently open the CUSTOMER
  // app.
  const cta = event.showCta
    ? {
        app:
          slug.startsWith("a.") || slug.startsWith("pa.")
            ? ("advertiser" as const)
            : ("customer" as const),
      }
    : undefined;

  await sendEmail({
    target: to,
    subject,
    bodyHtml,
    title,
    preheader,
    cta,
    unsubscribeUrl: isBulk
      ? unsubscribeUrlFor(target, recipientId, slug)
      : undefined,
    // Template splits by SHAPE, same as unsubscribe: every one-to-many bulk
    // send (promo events + ALL admin blasts — a blast is an announcement, the
    // masthead's exact job) gets the expressive "ink masthead" template; 1:1
    // transactional mail stays on the plain "note".
    template: isBulk ? "marketing" : "transactional",
    lang,
    fromEmail: isAdmin
      ? blastFromEmail
      : isBulk
        ? CONTACT.MARKETING_FROM_EMAIL
        : undefined,
    // Bulk-only analytics tags: Resend dashboard labels only (which mail
    // belongs to which env / promo step / blast / recipient). No webhook
    // consumes them — /webhooks/resend and open/click tracking were removed
    // 2026-08-05. Admin blasts add the per-blast `blast` tag on top of the
    // standard attribution set.
    tags: isPromo
      ? buildPromoEmailTags({ eventSlug: slug, target, recipient: analyticsId })
      : isAdmin
        ? [
            ...buildPromoEmailTags({
              eventSlug: slug,
              target,
              recipient: analyticsId,
            }),
            ...(blastSlug ? [{ name: "blast", value: blastSlug }] : []),
          ]
        : undefined,
    idempotencyKey,
  });
}

/** The unsubscribe link for a marketing email, by recipient type (else none).
 *  Carries the event slug in the signed token so the unsubscribe handler can
 *  attribute the opt-out to the email that drove it (`email_unsubscribed`). */
function unsubscribeUrlFor(
  target: AccountType,
  recipientId: number,
  eventSlug: string,
): string | undefined {
  if (target === "CUSTOMER") {
    return buildUnsubscribeUrl({
      kind: "customer",
      customerId: recipientId,
      slug: eventSlug,
    });
  }
  if (target === "PENDING_CUSTOMER") {
    return buildUnsubscribeUrl({
      kind: "pendingCustomer",
      pendingCustomerId: recipientId,
      slug: eventSlug,
    });
  }
  if (target === "ADVERTISER") {
    return buildUnsubscribeUrl({
      kind: "advertiser",
      advertiserId: recipientId,
      slug: eventSlug,
    });
  }
  if (target === "PENDING_ADVERTISER") {
    return buildUnsubscribeUrl({
      kind: "pendingAdvertiser",
      pendingAdvertiserId: recipientId,
      slug: eventSlug,
    });
  }
  return undefined;
}
