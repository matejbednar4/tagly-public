/**
 * Tagly email addresses — the single source of truth for every team inbox and
 * outbound sender. Permanent: not version-coupled.
 *
 * Two distinct groups:
 *  - **Inbound** (`*_EMAIL`): human inboxes on the root `@taglyapp.com` domain
 *    that receive mail — feedback submissions, support, general contact. Also
 *    used as the `replyTo` on outbound mail so replies land in a real inbox.
 *    (The legacy `@flaer.app` twins stay live as receiving aliases in Zoho, so
 *    mail to old addresses keeps arriving in the same group inboxes.)
 *  - **Outbound** (`NOTIFICATIONS_*` / `MARKETING_*`): the `From` identity on
 *    outbound mail, on dedicated sending subdomains with their own DKIM/SPF,
 *    kept separate from the inbound inboxes on purpose.
 */
import { envVariables } from "../../environment/envVariables.js";

// Production sends from the brand sending subdomains (`mail.` / `news.`
// taglyapp.com). Staging and local dev send EVERYTHING (transactional +
// marketing alike) from the single `mail.tagly.dev` domain — non-prod lives on
// the dev domain per the env-separation rule, so test/staging traffic can never
// touch the production domains' sender reputation. The staging RESEND_API_KEY
// is domain-restricted to `mail.tagly.dev`, so a non-prod sender here is also
// what keeps staging sends working at all. The two-stream mail/news reputation
// split is a prod-only deliverability measure; non-prod deliberately doesn't
// mirror it (one domain = one restrictable key).
const IS_PRODUCTION_SENDER = envVariables.APP_STAGE === "production";

export const CONTACT = {
  // Inbound team inboxes (and reply-to targets). All exist as Zoho group
  // aliases on taglyapp.com (verified 2026-07-25).
  FEEDBACK_EMAIL: "feedback@taglyapp.com",
  SUPPORT_EMAIL: "support@taglyapp.com",
  CONTACT_EMAIL: "hello@taglyapp.com",
  // Privacy / data-deletion contact (surfaced on the Meta data-deletion pages).
  LEGAL_EMAIL: "legal@taglyapp.com",
  // Ops/system-health alerts (`notify: true` money-integrity escalations via
  // `sendTeamAlertEmail`). Deliberately its own inbox, NOT support@ — a ledger
  // break must never queue behind password-help requests.
  HEALTH_EMAIL: "health@taglyapp.com",

  // Outbound senders — the `From` address on outbound mail (display name composed
  // at the send site). Split into two reputation streams so bulk/marketing
  // complaints can't drag down the deliverability of critical transactional + OTP
  // mail (they must share nothing, incl. the sending subdomain).
  //
  // PROTECTED stream: OTP + transactional. On the dedicated `mail.taglyapp.com`
  // sending subdomain (own DKIM/SPF — VERIFIED in Resend 2026-07-25).
  // `mail.flaer.app` stays verified in Resend as the rollback sender during the
  // new domain's warm-up window.
  NOTIFICATIONS_FROM_EMAIL: IS_PRODUCTION_SENDER
    ? "notifications@mail.taglyapp.com"
    : "notifications@mail.tagly.dev",
  // BULK stream: marketing (promo) + admin broadcasts — reputation-isolated from
  // the protected stream on the dedicated `news.taglyapp.com` sending subdomain
  // (own DKIM/SPF — VERIFIED in Resend 2026-07-25; complaints here can never
  // touch OTP/transactional deliverability on `mail.taglyapp.com`).
  MARKETING_FROM_EMAIL: IS_PRODUCTION_SENDER
    ? "hello@news.taglyapp.com"
    : "hello@mail.tagly.dev",
};
