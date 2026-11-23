/**
 * Resend analytics tags stamped on outbound sends — the PROMO attribution
 * tags and the cross-environment `env` tag.
 *
 * These are labels only: they show up on each email in the Resend dashboard
 * (which mail belongs to which env / promo step / recipient) and cost
 * nothing. The webhook that used to consume them (`/webhooks/resend` →
 * PostHog `email_opened`/`email_clicked`) was REMOVED 2026-08-05 along with
 * domain open/click tracking — tracking-domain link rewriting hurt
 * deliverability more than the open/click funnel was worth. Email engagement
 * is now measured only by `email_unsubscribed` (the unsubscribe handler) and
 * in-app activity.
 *
 * **The `env` tag** stays stamped on every product send (see `sendEmail`)
 * because Resend webhooks are ACCOUNT-scoped: every registered endpoint
 * receives every environment's events (E104/E251). If a webhook is ever
 * re-added, the strict same-env filter it needs is only possible because the
 * tag never stopped shipping — never remove it from `sendEmail`. Team/ops
 * mail (`sendTeamAlertEmail`) is deliberately untagged.
 *
 * Encoding: Resend tag names/values allow only `[A-Za-z0-9_-]`. Catalog slugs
 * are dot-separated kebab segments (letters, digits, dots, dashes — never
 * underscores), so `.` → `_` is a lossless mapping. If a slug ever needs an
 * underscore, this file is the invariant to revisit. `APP_STAGE` values
 * (development/staging/production) are pure lowercase ASCII, safely inside
 * the tag alphabet.
 */

export type PromoEmailTag = { name: string; value: string };

/** Tag name carrying the sending environment (`APP_STAGE`) on every send. */
export const EMAIL_ENV_TAG_NAME = "env";

export type PromoEmailTagData = {
  /** Canonical catalog slug (dot form, e.g. `c.promo.first-share.d7`). */
  eventSlug: string;
  /** Recipient AccountType (e.g. `CUSTOMER`, `PENDING_CUSTOMER`). */
  target: string;
  /**
   * Opaque recipient reference from `resolveRecipientAnalyticsId` — the
   * account uid, or `TARGET:id` for pendings. Never a bare DB primary key.
   */
  recipient: string;
};

export function buildPromoEmailTags(data: PromoEmailTagData): PromoEmailTag[] {
  return [
    { name: "slug", value: data.eventSlug.replace(/\./g, "_") },
    { name: "target", value: data.target },
    // Tag alphabet is [A-Za-z0-9_-]; uids fit, the pending `TARGET:id` form
    // needs its colon mapped.
    { name: "recipient", value: data.recipient.replace(/[^A-Za-z0-9_-]/g, "_") },
  ];
}
