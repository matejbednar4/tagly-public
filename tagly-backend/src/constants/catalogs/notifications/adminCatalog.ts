/**
 * Admin blast events — one-off announcements initiated from the admin app
 * (`POST /v2/admin/notifications/blast`), sent to the selected audiences.
 * (Retired 2026-08-02 as E050, revived 2026-08-13 with the v2 endpoint.)
 *
 * Two audience modes (see `BlastAudience`):
 *  - `PROMO_OPTED_IN` — recipients with explicit promo consent (`=== true`,
 *    the E056 rule). For promotional content.
 *  - `EVERYONE` — bypasses the marketing opt-out on the operational /
 *    legitimate-interest basis. STRICTLY for service / policy / incident
 *    notices (e.g. the rebrand announcement).
 *
 * Either way the email leg renders as BULK mail: the marketing "ink masthead"
 * template (a blast is an announcement — the masthead's exact job) with the
 * one-click unsubscribe + RFC 8058 headers. The unsubscribe opts the account
 * out of MARKETING only (deliverability: a mass send without one converts
 * "stop this" intent into spam reports); a rare future operational notice may
 * still arrive — the standard service-mail carve-out. The notifications
 * worker skips the promo opt-out gate for `notificationType: "admin"` in both
 * modes — the audience filter is applied at QUEUE time by the controller.
 *
 * ⚠️ The blast content is free-form (typed per send), so nothing technically
 * stops a marketing message going to EVERYONE — but that would be unlawful
 * (marketing to opted-out users). A regulator judges by the message's purpose,
 * not its type label. Marketing content → `PROMO_OPTED_IN` audience, always.
 *
 * Content is PER-LANGUAGE in the job payload:
 * `{ push?: { en, cs? }, email?: { en, cs? } }`. Like the promo catalog, each
 * event carries `en`/`cs` template variants and the send pipeline picks by the
 * recipient's resolved language (`pickAdminTemplate`); the `cs` variants fall
 * back to the EN content when no CS copy was provided.
 *
 * Unlike promo events, these have no cadence and are not scheduling-driven.
 * Deduplication is a content-hash dedupeKey set per blast run (re-running the
 * identical blast only queues recipients who weren't covered before); no
 * PromoNotificationLog entries are written.
 *
 * Per-blast tracking: the admin-chosen `blastSlug` in the payload overrides
 * the push payload's `slug` as `<event slug>:<blastSlug>` — the apps forward
 * that string verbatim in their `push_opened` PostHog event, so per-blast open
 * counts work on every shipped build with no client change. The email leg
 * stamps the same value as the `blast` Resend tag (dashboard filter), and
 * picks its From identity from the payload's optional `senderDomain` override
 * (`notifications@<domain>`, Resend-verified at enqueue time; see
 * `sendEmailNotification`).
 */

import { AccountType, NotificationChannel } from "../../../generated/prisma/client.js";
import type { AdminEvent, PushTemplate, EmailTemplate } from "./notificationTypes.js";
import { escapeEmailHtml } from "../../../utils/email/templates/escapeEmailHtml.js";
import { renderEmailButton } from "../../../utils/email/templates/renderEmailButton.js";

const { CUSTOMER, ADVERTISER, PENDING_CUSTOMER, PENDING_ADVERTISER } =
  AccountType;
const { PUSH, EMAIL } = NotificationChannel;

type BlastLang = "en" | "cs";

type BlastPushContent = { title?: string; body?: string };
type BlastEmailContent = {
  subject?: string;
  body?: string;
  title?: string;
  preheader?: string;
  /** When set, the email ends with a CTA button that opens the audience's app.
   *  Email CTAs never point anywhere else (see `renderEmailButton`) — there is
   *  deliberately no URL field. */
  ctaLabel?: string;
};

type BlastPayload = {
  /** Admin-chosen kebab-case tracking slug (see header). */
  blastSlug?: string;
  /** BlastAudience — audit/analytics record only. The queue-time filter
   *  already applied it, and the email leg renders as bulk mail (marketing
   *  template + unsubscribe) regardless of audience. */
  audience?: string;
  /** Resend-verified sending-domain override for the email leg
   *  (`notifications@<domain>`); absent = the default marketing sender. */
  senderDomain?: string;
  push?: { en?: BlastPushContent; cs?: BlastPushContent };
  email?: { en?: BlastEmailContent; cs?: BlastEmailContent };
};

/** The language's push content, CS falling back to EN. */
const pushContent = (p: BlastPayload, lang: BlastLang) =>
  (lang === "cs" ? (p.push?.cs ?? p.push?.en) : p.push?.en) ?? {};

/** The language's email content, CS falling back to EN. */
const emailContent = (p: BlastPayload, lang: BlastLang) =>
  (lang === "cs" ? (p.email?.cs ?? p.email?.en) : p.email?.en) ?? {};

/**
 * Converts plain-text admin email body + optional CTA into an HTML string for
 * the email template. Each newline-separated paragraph becomes a <p> element.
 * HTML entities in the body are escaped. The CTA (when `ctaLabel` is set)
 * always opens the blast audience's app.
 */
function buildBlastEmailHtml(
  c: BlastEmailContent,
  app: "customer" | "advertiser",
): string {
  const paragraphs = escapeEmailHtml(c.body ?? "")
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 16px;">${line}</p>`)
    .join("\n");

  const cta = c.ctaLabel
    ? `\n<p style="margin:24px 0 0;">${renderEmailButton({
        app,
        label: c.ctaLabel,
        size: "sm",
      })}</p>`
    : "";

  return `${paragraphs}${cta}`;
}

/** Blast email template for one language, bound to the audience's app. */
const blastEmailTemplate = (
  app: "customer" | "advertiser",
  lang: BlastLang,
): EmailTemplate => ({
  subject: (p: BlastPayload) => emailContent(p, lang).subject ?? "",
  html: (p: BlastPayload) => buildBlastEmailHtml(emailContent(p, lang), app),
  preheader: (p: BlastPayload) => emailContent(p, lang).preheader,
  title: (p: BlastPayload) => emailContent(p, lang).title,
});

/**
 * Blast push template for one language. The `data` fn overrides the payload
 * `slug` (spread after the base slug in `sendPushNotification`) with the
 * per-blast tracked form `admin.blast:<blastSlug>` — deliberately WITHOUT the
 * target segment, so one blast aggregates under one slug in PostHog no matter
 * which audiences it went to — and adds `blastSlug` on its own key for future
 * clients that want it structured.
 */
const blastPushTemplate = (lang: BlastLang): PushTemplate => ({
  title: (p: BlastPayload) => pushContent(p, lang).title ?? "",
  body: (p: BlastPayload) => pushContent(p, lang).body ?? "",
  data: (p: BlastPayload) =>
    p.blastSlug
      ? { slug: `admin.blast:${p.blastSlug}`, blastSlug: p.blastSlug }
      : {},
});

/** Localized admin event — `en`/`cs` variants like the promo catalog. */
export type LocalizedAdminEvent = Omit<AdminEvent, "push" | "email"> & {
  en: { push?: PushTemplate; email?: EmailTemplate };
  cs: { push?: PushTemplate; email?: EmailTemplate };
};

const blastEvent = (
  target: AccountType,
  app: "customer" | "advertiser",
): LocalizedAdminEvent => ({
  target,
  categorySlug: "admin",
  notificationType: "admin" as const,
  availableChannels: [PUSH, EMAIL] as const,
  en: {
    push: blastPushTemplate("en"),
    email: blastEmailTemplate(app, "en"),
  },
  cs: {
    push: blastPushTemplate("cs"),
    email: blastEmailTemplate(app, "cs"),
  },
});

export const adminEventsRaw = {
  "admin.blast.customer": blastEvent(CUSTOMER, "customer"),
  "admin.blast.advertiser": blastEvent(ADVERTISER, "advertiser"),
  // Pending customers are mid-signup CUSTOMER-app users.
  "admin.blast.pending_customer": blastEvent(PENDING_CUSTOMER, "customer"),
  // Pending advertisers are mid-signup ADVERTISER-app users.
  "admin.blast.pending_advertiser": blastEvent(PENDING_ADVERTISER, "advertiser"),
} satisfies Record<string, LocalizedAdminEvent>;

export type AdminEventSlug = keyof typeof adminEventsRaw;
