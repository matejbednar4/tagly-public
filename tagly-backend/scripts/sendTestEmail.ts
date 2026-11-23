/**
 * Dev-only: render any notification-catalog email and send it to yourself (or
 * dump it to an HTML file without sending).
 *
 * This goes through the SAME pipeline a real send does — `pickEventTemplate`
 * for the localized copy, then `sendEmail`, which picks the marketing vs
 * transactional template, stamps the `env` tag, and adds the RFC 8058
 * `List-Unsubscribe` headers on promo mail. So what lands in your inbox is what
 * a customer would get, not an approximation.
 *
 *   yarn email:test --list
 *   yarn email:test --to=you@taglyapp.com --slug=a.promo.add-budget.d1 --lang=cs
 *   yarn email:test --slug=c.shares.rated --payload='{"shareUid":"s-abc"}' --html=/tmp/preview.html
 *
 * Flags:
 *   --to=<email>      recipient. Required unless --html.
 *   --slug=<slug>     any catalog slug (promo OR transactional). Default a.promo.add-budget.d1.
 *   --lang=en|cs      default en.
 *   --payload=<json>  template data for slugs whose copy interpolates values.
 *   --html=<path>     render to a file and exit — no send, no Resend call at all.
 *   --recipient=<kind:id>  build a REAL unsubscribe token for that recipient
 *                     (customer|advertiser|pendingCustomer|pendingAdvertiser).
 *                     Default customer:0 — a valid link that resolves to nobody.
 *
 * ⚠️ A real send goes out over the production sending domains (there is no
 * per-env sender yet, see FUTURE.md "Per-environment outbound email sender
 * identities") and counts toward the shared reputation. Send to yourself only,
 * and prefer --html while iterating on design.
 */
import { writeFileSync } from "node:fs";
import {
  notificationEvents,
  pickEventTemplate,
  type AnyEventSlug,
} from "../src/constants/catalogs/notifications/notificationRegistry.js";
import { promoEventsRaw } from "../src/constants/catalogs/notifications/promoCatalog.js";
import { sendEmail } from "../src/utils/email/sendEmail.js";
import { buildUnsubscribeUrl } from "../src/utils/email/unsubscribeToken.js";
import { buildMarketingEmailHTML } from "../src/utils/email/templates/buildMarketingEmailHTML.js";
import { buildTransactionalEmailHTML } from "../src/utils/email/templates/buildTransactionalEmailHTML.js";
import { CONTACT } from "../src/constants/platform/CONTACT.js";
import { envVariables } from "../src/environment/envVariables.js";
import type { SupportedLanguage } from "@tagly/models/shared";

const DEFAULT_SLUG = "a.promo.add-budget.d1";

const arg = (name: string): string | undefined => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? "" : hit.slice(eq + 1);
};

/** Many catalog steps are push-only — show that here instead of making you guess. */
const hasEmail = (slug: string) => {
  try {
    return Boolean(pickEventTemplate(slug as AnyEventSlug, "en").email);
  } catch {
    return false;
  }
};

const listSlugs = () => {
  const promo = Object.keys(promoEventsRaw).sort();
  const other = Object.keys(notificationEvents)
    .filter((s) => !(s in promoEventsRaw))
    .sort();
  const line = (s: string) =>
    console.log(`  ${hasEmail(s) ? "✉ " : "  "} ${s}${hasEmail(s) ? "" : "   (push only)"}`);
  console.log(`\nPROMO — marketing template (${promo.filter(hasEmail).length}/${promo.length} emailable):`);
  promo.forEach(line);
  console.log(`\nTRANSACTIONAL / OTHER — note template (${other.filter(hasEmail).length}/${other.length} emailable):`);
  other.forEach(line);
  console.log("");
};

/** The worker's rule verbatim: `a.`/`pa.` → advertiser, everything else → customer. */
const ctaAppFor = (slug: string) =>
  slug.startsWith("a.") || slug.startsWith("pa.")
    ? ("advertiser" as const)
    : ("customer" as const);

const unsubscribeFor = (slug: string, spec: string): string => {
  const [kind, rawId] = spec.split(":");
  const id = Number(rawId ?? 0);
  if (!Number.isFinite(id)) throw new Error(`Bad --recipient id in "${spec}"`);
  switch (kind) {
    case "customer":
      return buildUnsubscribeUrl({ kind, customerId: id, slug });
    case "advertiser":
      return buildUnsubscribeUrl({ kind, advertiserId: id, slug });
    case "pendingCustomer":
      return buildUnsubscribeUrl({ kind, pendingCustomerId: id, slug });
    case "pendingAdvertiser":
      return buildUnsubscribeUrl({ kind, pendingAdvertiserId: id, slug });
    default:
      throw new Error(
        `Unknown --recipient kind "${kind}". Use customer|advertiser|pendingCustomer|pendingAdvertiser.`,
      );
  }
};

async function main() {
  if (process.argv.includes("--list")) {
    listSlugs();
    return;
  }

  const slug = (arg("slug") || DEFAULT_SLUG) as AnyEventSlug;
  const lang = ((arg("lang") || "en") as SupportedLanguage) ?? "en";
  const to = arg("to");
  const htmlPath = arg("html");
  const recipient = arg("recipient") || "customer:0";

  const event = notificationEvents[slug];
  if (!event) {
    console.error(`Unknown slug "${slug}". Run with --list to see them all.`);
    process.exit(1);
  }

  const template = pickEventTemplate(slug, lang).email;
  if (!template) {
    console.error(`Event "${slug}" has no email template (push-only step).`);
    process.exit(1);
  }

  let data: unknown = {};
  const rawPayload = arg("payload");
  if (rawPayload) {
    try {
      data = JSON.parse(rawPayload);
    } catch {
      console.error(`--payload is not valid JSON: ${rawPayload}`);
      process.exit(1);
    }
  }

  // Same derivation the notifications worker does, so the test matches a real send.
  const isPromo = event.notificationType === "promo";
  const isBulk = isPromo || event.notificationType === "admin";
  const bodyHtml = (template.html as (d: unknown) => string)(data);
  const title = template.title
    ? (template.title as (d: unknown) => string)(data)
    : undefined;
  const preheader = template.preheader
    ? (template.preheader as (d: unknown) => string)(data)
    : undefined;
  const subject =
    typeof template.subject === "function"
      ? (template.subject as (d: unknown) => string)(data)
      : template.subject;
  const cta = event.showCta ? { app: ctaAppFor(slug) } : undefined;
  const unsubscribeUrl = isPromo ? unsubscribeFor(slug, recipient) : undefined;

  console.log(`slug        ${slug}`);
  console.log(`lang        ${lang}`);
  console.log(`type        ${event.notificationType}`);
  console.log(`template    ${isPromo ? "marketing" : "transactional"}`);
  console.log(`subject     ${subject}`);
  console.log(`cta         ${cta ? cta.app : "none"}`);
  console.log(`unsubscribe ${unsubscribeUrl ? "yes (+ List-Unsubscribe headers)" : "no"}`);

  if (htmlPath) {
    const opts = { bodyHtml, title: title ?? subject, preheader: preheader ?? subject, unsubscribeUrl, cta, lang };
    const html = isPromo
      ? buildMarketingEmailHTML(opts)
      : buildTransactionalEmailHTML(opts);
    writeFileSync(htmlPath, html);
    console.log(`\nWrote ${html.length} bytes to ${htmlPath} — nothing sent.`);
    return;
  }

  if (!to) {
    console.error("\n--to=<email> is required (or use --html=<path> to preview without sending).");
    process.exit(1);
  }

  // This file is committed, so it is one `yarn` away from anyone with a prod
  // .env. Real recipients are never a test target — refuse outright rather than
  // trusting the operator to have read the docblock.
  if (envVariables.APP_STAGE === "production") {
    console.error(
      "\nRefusing to send: APP_STAGE is production. Test sends run from a dev or staging env only.",
    );
    process.exit(1);
  }

  if (unsubscribeUrl && !unsubscribeUrl.startsWith("https://")) {
    console.log(
      `\n⚠️  API_BASE_URL is local, so the unsubscribe link in this mail points at\n    your machine and will not resolve from an inbox. Fine for looks, not for clicking.`,
    );
  }

  console.log(`from        ${isBulk ? CONTACT.MARKETING_FROM_EMAIL : CONTACT.NOTIFICATIONS_FROM_EMAIL}`);
  console.log(`to          ${to}`);
  console.log(`env tag     ${envVariables.APP_STAGE}`);

  await sendEmail({
    target: to,
    subject,
    bodyHtml,
    title,
    preheader,
    cta,
    unsubscribeUrl,
    template: isPromo ? "marketing" : "transactional",
    lang,
    fromEmail: isBulk ? CONTACT.MARKETING_FROM_EMAIL : undefined,
    tags: [{ name: "test_send", value: "1" }],
  });

  console.log("\nSent.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
