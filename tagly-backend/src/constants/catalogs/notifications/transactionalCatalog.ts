import type { PushTemplate, EmailTemplate } from "./notificationTypes.js";
import type { NotificationEventSlug } from "@tagly/models/shared";
import { escapeEmailHtml } from "../../../utils/email/templates/escapeEmailHtml.js";
import { CONTACT } from "../../platform/CONTACT.js";

/**
 * The monthly-budget "upcoming charge" date, from the payload's ISO stamp
 * (the run is on the 1st in UTC terms — `CHARGE_HOUR_UTC` — so the UTC
 * calendar day is the day to show; local-tz rendering would say "the 31st"
 * on the US West Coast). Degrades to a generic phrase on a missing
 * or malformed value — a template must never throw.
 */
function formatNoticeDate(iso: unknown, lang: "en" | "cs"): string {
  const d = typeof iso === "string" ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return lang === "cs" ? "prvního dne v měsíci" : "the 1st of the month";
  }
  return d.toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// Push/email templates for every transactional event slug declared in the
// shared catalog (@tagly/models notificationEventsCatalog). Metadata
// (label, description, category, target, channels) lives in shared — this
// file only holds the rendering layer.
//
// Each entry is bilingual: `en` and `cs` each carry their own
// {push?, email?} pair. The send pipeline picks the variant by resolving
// the recipient's language at send time (see pickTransactionalTemplate
// in notificationRegistry). Until that wiring lands, callers fall back to
// `en` for back-compat.
//
// The seeder validates at startup that every shared slug has a template
// here, and that there are no orphan templates without a shared slug.
//
// Adding a new event needs NO backfill or version bump: preferences are
// opt-OUT (`NotificationEventOptOut` — a missing row means every available
// channel is on), so a newly seeded event is on-by-default for every existing
// account the moment the boot seed creates its NotificationEvent row.

type LocalizedTransactionalTemplate = {
  /**
   * Email-only: when true, the email ends with the standard CTA button that
   * opens the recipient's app (resolved from the slug prefix — `a.` →
   * advertiser app, else customer app; see `BaseEvent.showCta`). Backend-only
   * send behavior, so it lives here with the rendering layer, not in the
   * shared metadata catalog. Set it when the email's natural next step is in
   * the app; leave unset for security, legal, and ban mail.
   */
  showCta?: boolean;
  en: { push?: PushTemplate; email?: EmailTemplate };
  cs: { push?: PushTemplate; email?: EmailTemplate };
};

export const transactionalTemplates = {
  // -------- CUSTOMER --------
  "c.shares.rated": {
    showCta: true,
    en: {
      push: {
        title: "⭐ Your share was rated",
        body: (payload) =>
          `See what ${payload?.localName ?? "the business"} thought of your share.`,
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
    cs: {
      push: {
        title: "⭐ Tvé sdílení bylo ohodnoceno",
        body: (payload) =>
          `Mrkni, co si o něm ${payload?.localName ?? "podnik"} myslí.`,
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
  },
  "c.shares.rejected": {
    showCta: true,
    en: {
      push: {
        title: "❌ Your share was rejected",
        body: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : "One of your shares was rejected during review.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
      email: {
        subject: "One of your shares was rejected",
        title: () => "Your share was rejected",
        preheader: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : "An admin rejected one of your shares during review.",
        html: (payload) =>
          [
            "<p>One of your shares on Tagly was rejected by our team during review, so it won't be paid out.</p>",
            payload?.reason
              ? `<p><strong>Reason:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            `<p>If you believe this was a mistake, please contact us at <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "❌ Tvé sdílení neprošlo kontrolou",
        body: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : "Jedno z tvých sdílení jsme při kontrole museli zamítnout.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
      email: {
        subject: "Tvé sdílení neprošlo kontrolou",
        title: () => "Sdílení neprošlo kontrolou",
        preheader: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : "Jedno z tvých sdílení jsme při kontrole museli zamítnout.",
        html: (payload) =>
          [
            "<p>Při kontrole jsme museli jedno z tvých sdílení zamítnout. Odměna za něj proto nebude zaplacena.</p>",
            payload?.reason
              ? `<p><strong>Důvod:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            `<p>Pokud si myslíš, že došlo k chybě, kontaktuj prosím naši podporu na <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
  },
  "c.shares.unpayable": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ A share can't be paid",
        body: () =>
          "One of your shares can no longer be verified, so it won't be paid.",
        data: () => ({ screen: "shares" }),
      },
    },
    cs: {
      push: {
        title: "⚠️ Sdílení nelze zaplatit",
        body: () =>
          "Jedno z tvých sdílení už nejde ověřit, takže nebude zaplaceno.",
        data: () => ({ screen: "shares" }),
      },
    },
  },
  "c.account.multiplier-updated": {
    showCta: true,
    en: {
      push: {
        title: "⭐ Your rating was updated",
        body: () =>
          "Our team adjusted your account rating. It affects the rewards of your future shares.",
      },
    },
    cs: {
      push: {
        title: "⭐ Upravili jsme ti hodnocení",
        body: () => "Má vliv na výši odměn za tvá další sdílení.",
      },
    },
  },
  "c.account.banned": {
    en: {
      push: {
        title: "🚫 Your account has been banned",
        body: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : "You can still sign in, but can't create shares or withdraw.",
      },
      email: {
        subject: "Your Tagly account has been banned",
        title: () => "Your account has been banned",
        preheader: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : "Your Tagly account has been banned.",
        html: (payload) =>
          [
            "<p>Your Tagly account has been banned. You can still sign in, but you can no longer create shares or withdraw funds.</p>",
            payload?.reason
              ? `<p><strong>Reason:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            `<p>If you believe this was a mistake, please contact us at <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "🚫 Tvůj účet byl zablokován",
        body: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : "Stále se můžeš přihlásit, ale nemůžeš sdílet ani vybírat peníze.",
      },
      email: {
        subject: "Tvůj účet Tagly byl zablokován",
        title: () => "Tvůj účet byl zablokován",
        preheader: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : "Tvůj účet Tagly byl zablokován.",
        html: (payload) =>
          [
            "<p>Tvůj účet Tagly byl zablokován. Stále se můžeš přihlásit, ale už nemůžeš vytvářet sdílení ani vybírat peníze.</p>",
            payload?.reason
              ? `<p><strong>Důvod:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            `<p>Pokud si myslíš, že došlo k chybě, kontaktuj prosím naši podporu na <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
  },
  "c.account.unbanned": {
    showCta: true,
    en: {
      push: {
        title: "✅ Your account has been unbanned",
        body: () => "You can create shares and withdraw your funds again.",
      },
      email: {
        subject: "Your Tagly account has been unbanned",
        title: () => "Your account has been unbanned",
        preheader: () =>
          "Your Tagly account has been unbanned. You can share and withdraw again.",
        html: () =>
          [
            "<p>Good news! Your Tagly account has been unbanned.</p>",
            "<p>You can now create shares and withdraw your funds again.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "✅ Tvůj účet byl odblokován",
        body: () => "Zase můžeš sdílet a vybírat peníze.",
      },
      email: {
        subject: "Tvůj účet Tagly byl odblokován",
        title: () => "Tvůj účet byl odblokován",
        preheader: () =>
          "Tvůj účet Tagly je zase aktivní. Můžeš dál sdílet a vybírat peníze.",
        html: () =>
          [
            "<p>Dobrá zpráva! Tvůj účet Tagly je zase aktivní.</p>",
            "<p>Můžeš dál sdílet a vybírat peníze.</p>",
          ].join(""),
      },
    },
  },
  "c.account.payouts-enabled": {
    showCta: true,
    en: {
      push: {
        title: "💸 Payouts enabled",
        body: () => "You can withdraw your earnings anytime.",
        data: () => ({ screen: "cash-out" }),
      },
    },
    cs: {
      push: {
        title: "💸 Výběry jsou zapnuté",
        body: () => "Své výdělky si můžeš kdykoli vybrat.",
        data: () => ({ screen: "cash-out" }),
      },
    },
  },
  "c.account.payouts-disabled": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Payouts temporarily disabled",
        body: () =>
          "Stripe temporarily disabled your payouts. Open Tagly to access your Stripe dashboard.",
        data: () => ({ screen: "cash-out" }),
      },
      email: {
        subject: "Payouts disabled for your Tagly account",
        title: () => "Action needed to re-enable payouts",
        preheader: () =>
          "Stripe requires additional information to resume your payouts.",
        html: () =>
          [
            "<p>Your payouts have been temporarily disabled by Stripe.</p>",
            "<p>This normally happens when Stripe needs you to update or confirm information in your Stripe Express account (for example, identity verification or payout details).</p>",
            "<p>Tagly cannot change your payout status, only Stripe can. Go to your Stripe dashboard from the app and complete the required steps.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Výběry jsou dočasně pozastavené",
        body: () =>
          "Stripe dočasně pozastavil tvé výběry. V aplikaci otevři panel Stripe a dokonči, co chybí.",
        data: () => ({ screen: "cash-out" }),
      },
      email: {
        subject: "Stripe pozastavil výběry z tvého účtu Tagly",
        title: () => "Výběry potřebují tvou pozornost",
        preheader: () =>
          "Stripe potřebuje doplnit údaje, aby mohl výběry zase zapnout.",
        html: () =>
          [
            "<p>Stripe dočasně pozastavil výběry z tvého účtu.</p>",
            "<p>Obvykle to znamená, že potřebuje doplnit nebo potvrdit některé údaje, třeba ověření totožnosti nebo bankovní účet. Tagly stav výběrů změnit nemůže, to umí jen Stripe.</p>",
            "<p>Přejdi v aplikaci do svého panelu Stripe a dokonči požadované kroky.</p>",
          ].join(""),
      },
    },
  },
  "c.balance.share-payout": {
    showCta: true,
    en: {
      push: {
        title: (payload) =>
          payload?.amountFormatted
            ? `💸 You earned ${payload.amountFormatted}`
            : "💸 Your share was paid",
        body: (payload) => `For sharing ${payload?.localName ?? "a business"}.`,
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
    cs: {
      push: {
        title: (payload) =>
          payload?.amountFormatted
            ? `💸 Získal/a jsi ${payload.amountFormatted}`
            : "💸 Tvé sdílení bylo zaplaceno",
        body: (payload) => `Za sdílení ${payload?.localName ?? "podniku"}.`,
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
  },
  "c.balance.withdrawal-failed": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Your payout couldn't be completed",
        body: () =>
          "Stripe couldn't send your payout. Open Tagly to access your Stripe dashboard and see what to fix.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Your payout from Tagly couldn't be completed",
        title: () => "Action needed to fix your payout",
        preheader: () =>
          "Stripe couldn't complete your payout. Your funds are still in your Stripe balance.",
        html: () =>
          [
            "<p>Stripe was not able to complete your payout. Your funds are still in your Stripe balance.</p>",
            "<p>This usually happens when Stripe needs you to update or confirm information, such as payout details or identity verification. Go to your Stripe dashboard from the app to see what needs to be fixed.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Tvůj výběr se nezdařil",
        body: () =>
          "Stripe nemohl výběr odeslat. V aplikaci otevři panel Stripe a zjisti, co je potřeba opravit.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Tvůj výběr z Tagly se nezdařil",
        title: () => "Výběr potřebuje tvou pozornost",
        preheader: () =>
          "Stripe nemohl výběr dokončit. Peníze zůstávají ve tvém zůstatku u Stripu.",
        html: () =>
          [
            "<p>Stripe nemohl dokončit tvůj výběr. Nic se neztratilo, peníze zůstávají ve tvém zůstatku u Stripu.</p>",
            "<p>Obvykle to znamená, že Stripe potřebuje doplnit nebo potvrdit některé údaje, třeba bankovní účet nebo ověření totožnosti. Přejdi v aplikaci do svého panelu Stripe a podívej se, co je potřeba doplnit.</p>",
          ].join(""),
      },
    },
  },
  "c.balance.withdrawal-completed": {
    showCta: true,
    en: {
      push: {
        title: "💸 Withdrawal completed",
        body: () =>
          "Stripe has sent your payout to your bank. It may take some time to appear in your account.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Your withdrawal from Tagly is complete",
        title: () => "Your payout has been sent",
        preheader: () =>
          "Stripe has sent your payout to your bank. Timing may depend on your bank.",
        html: () =>
          [
            "<p>Your withdrawal from Tagly has been completed.</p>",
            "<p>Stripe has sent your payout to your bank. It may take a day or two to appear depending on your bank.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "💸 Výběr je hotový",
        body: () =>
          "Stripe odeslal peníze do tvé banky. Může chvíli trvat, než se objeví na účtu.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Tvůj výběr z Tagly je hotový",
        title: () => "Peníze jsou na cestě",
        preheader: () =>
          "Stripe odeslal peníze do tvé banky. Doba doručení záleží na tvé bance.",
        html: () =>
          [
            "<p>Tvůj výběr z Tagly je hotový.</p>",
            "<p>Stripe poslal peníze do tvé banky. Než se objeví na účtu, může to podle banky trvat den nebo dva.</p>",
          ].join(""),
      },
    },
  },
  "c.balance.withdrawal-reversed": {
    showCta: true,
    en: {
      push: {
        title: "💸 Money returned to your balance",
        body: () =>
          "A withdrawal couldn't be completed and the money was returned to your Tagly balance. You can withdraw it again anytime.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Money from your withdrawal returned to your Tagly balance",
        title: () => "Your money came back",
        preheader: () =>
          "The money is back on your Tagly balance. You can withdraw it again anytime.",
        html: () =>
          [
            "<p>One of your withdrawals couldn't be completed, so the money was returned to your Tagly balance in full.</p>",
            "<p>You can start a new withdrawal anytime. If this keeps happening, check your payout details in your Stripe dashboard.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "💸 Peníze se vrátily na tvůj zůstatek",
        body: () =>
          "Výběr se nepodařilo dokončit a peníze se vrátily na tvůj zůstatek Tagly. Můžeš je kdykoli vybrat znovu.",
        data: () => ({ screen: "withdrawals" }),
      },
      email: {
        subject: "Peníze z tvého výběru se vrátily na tvůj zůstatek Tagly",
        title: () => "Peníze z výběru se vrátily",
        preheader: () =>
          "Peníze jsou zpět ve tvém zůstatku Tagly. Můžeš je kdykoli vybrat znovu.",
        html: () =>
          [
            "<p>Jeden z tvých výběrů se nepodařilo dokončit, takže se peníze v plné výši vrátily na tvůj zůstatek Tagly.</p>",
            "<p>Vybrat je můžeš znovu kdykoli. Pokud se to stane opakovaně, zkontroluj si údaje pro výběr ve svém panelu Stripe.</p>",
          ].join(""),
      },
    },
  },
  "c.security.email-change": {
    en: {
      email: {
        subject: "Your Tagly email address was changed",
        title: () => "Your Tagly email was updated",
        preheader: () =>
          "If this wasn't you, reply to this email or contact support immediately.",
        html: () =>
          [
            "<p>We're letting you know that the email address on your Tagly account was recently changed.</p>",
            "<p>If you made this change, you don't need to do anything.</p>",
            `<p>If this wasn't you, please reply to this email or contact us at <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a> immediately so we can help recover your account.</p>`,
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Na tvém účtu Tagly se změnil e-mail",
        title: () => "Změna e-mailu na tvém účtu",
        preheader: () =>
          "Pokud tato změna není od tebe, odpověz na tento e-mail nebo okamžitě kontaktuj naši podporu.",
        html: () =>
          [
            "<p>Na tvém účtu Tagly se nedávno změnila e-mailová adresa.</p>",
            "<p>Pokud je tato změna od tebe, nemusíš nic dělat.</p>",
            `<p>Pokud tato změna není od tebe, prosím odpověz na tento e-mail nebo okamžitě kontaktuj naši podporu na <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>, abychom ti pomohli obnovit účet.</p>`,
          ].join(""),
      },
    },
  },
  "c.legal.tos-updated": {
    en: {
      email: {
        subject: "We've updated the Tagly Terms of Service",
        title: () => "Tagly Terms of Service update",
        preheader: () =>
          "Review the updated Terms of Service before opening the app.",
        html: () =>
          [
            "<p>We've updated the Tagly Terms of Service.</p>",
            '<p>You can review the latest version any time at <a href="https://www.taglyapp.com/terms-of-service" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-service</a>.</p>',
            "<p>The next time you open the Tagly app, you may be asked to review and agree to the updated terms.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Aktualizovali jsme Obchodní podmínky Tagly",
        title: () => "Aktualizace Obchodních podmínek Tagly",
        preheader: () =>
          "Prohlédni si aktualizované Obchodní podmínky, než otevřeš aplikaci.",
        html: () =>
          [
            "<p>Aktualizovali jsme Obchodní podmínky Tagly.</p>",
            '<p>Aktuální verzi si můžeš kdykoli prohlédnout na <a href="https://www.taglyapp.com/terms-of-service" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-service</a>.</p>',
            "<p>Až příště otevřeš aplikaci Tagly, možná tě poprosíme o souhlas s aktualizovanými podmínkami.</p>",
          ].join(""),
      },
    },
  },
  "c.legal.pp-updated": {
    en: {
      email: {
        subject: "We've updated the Tagly Privacy Policy",
        title: () => "Tagly Privacy Policy update",
        preheader: () =>
          "We've made changes to how we describe the use and protection of your data.",
        html: () =>
          [
            "<p>We've updated the Tagly Privacy Policy.</p>",
            '<p>You can review the latest version any time at <a href="https://www.taglyapp.com/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/privacy-policy</a>.</p>',
            "<p>The next time you open the Tagly app, you may be asked to review and acknowledge the updated policy.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Aktualizovali jsme Zásady ochrany osobních údajů Tagly",
        title: () => "Aktualizace Zásad ochrany osobních údajů Tagly",
        preheader: () =>
          "Provedli jsme změny v tom, jak popisujeme použití a ochranu tvých údajů.",
        html: () =>
          [
            "<p>Aktualizovali jsme Zásady ochrany osobních údajů Tagly.</p>",
            '<p>Aktuální verzi si můžeš kdykoli prohlédnout na <a href="https://www.taglyapp.com/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/privacy-policy</a>.</p>',
            "<p>Až příště otevřeš aplikaci Tagly, možná tě poprosíme o potvrzení aktualizovaných zásad.</p>",
          ].join(""),
      },
    },
  },
  "c.legal.tom-updated": {
    en: {
      email: {
        subject: "We've updated the Tagly Terms of Monetization",
        title: () => "Tagly Terms of Monetization update",
        preheader: () =>
          "We've made changes to how monetization on Tagly is governed.",
        html: () =>
          [
            "<p>We've updated the Tagly Terms of Monetization.</p>",
            '<p>You can review the latest version any time at <a href="https://www.taglyapp.com/terms-of-monetization" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-monetization</a>.</p>',
            "<p>The next time you open the Tagly app, you may be asked to review and agree to the updated terms.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Aktualizovali jsme Podmínky monetizace Tagly",
        title: () => "Aktualizace Podmínek monetizace Tagly",
        preheader: () =>
          "Provedli jsme změny v tom, jak je monetizace na Tagly upravena.",
        html: () =>
          [
            "<p>Aktualizovali jsme Podmínky monetizace Tagly.</p>",
            '<p>Aktuální verzi si můžeš kdykoli prohlédnout na <a href="https://www.taglyapp.com/terms-of-monetization" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-monetization</a>.</p>',
            "<p>Až příště otevřeš aplikaci Tagly, možná tě poprosíme o souhlas s aktualizovanými podmínkami.</p>",
          ].join(""),
      },
    },
  },

  // -------- ADVERTISER --------
  "a.shares.created": {
    showCta: true,
    en: {
      push: {
        title: (payload) =>
          `📣 Someone just shared ${payload?.localName ?? "your business"}`,
        body: () => "See the share and rate it.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
    cs: {
      push: {
        title: (payload) =>
          `📣 Někdo právě sdílel ${payload?.localName ?? "tvůj podnik"}`,
        body: () => "Podívej se na sdílení a ohodnoť ho.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
  },
  "a.reminders.low-balance": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Your credits are running low",
        body: () =>
          "Your business will soon stop being visible to customers. Top up to stay visible.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "Your Tagly credits are running low",
        title: () => "Your credits are running low",
        preheader: () =>
          "Your business will soon stop being visible to customers. Top up to stay visible.",
        html: () =>
          [
            "<p>Your Tagly credit balance is running low. If it runs out, your business will stop being visible to customers.</p>",
            "<p>Top up your credits to keep getting found and shared without interruption.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Docházejí ti kredity",
        body: () =>
          "Tvůj podnik brzy přestane být pro zákazníky viditelný. Dobij si kredity, ať zůstaneš vidět.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "Docházejí ti kredity na Tagly",
        title: () => "Docházejí ti kredity",
        preheader: () =>
          "Tvůj podnik brzy přestane být pro zákazníky viditelný. Dobij si kredity, ať zůstaneš vidět.",
        html: () =>
          [
            "<p>Kredity na Tagly ti docházejí. Až dojdou úplně, tvůj podnik přestane být pro zákazníky viditelný.</p>",
            "<p>Dobij si kredity včas, ať tě zákazníci dál nacházejí a sdílejí.</p>",
          ].join(""),
      },
    },
  },
  "a.shares.report-updated": {
    showCta: true,
    en: {
      push: {
        title: (payload) =>
          payload?.verdict === "VALID"
            ? "✅ Your report was confirmed"
            : "ℹ️ Your report was dismissed",
        // `wasPaid` (E047): a report ruled AFTER the share settled moves no
        // money — the copy must not promise a refund that never comes.
        body: (payload) =>
          payload?.verdict === "VALID"
            ? payload?.wasPaid
              ? "The reported share was found invalid. The reward was already paid, but the customer's rating was lowered."
              : "The reported share was found invalid. You won't pay for it."
            : payload?.wasPaid
              ? "Our team reviewed your report and decided it is invalid. The share stays paid."
              : "Our team reviewed your report and decided it is invalid. The share will be paid out.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
    cs: {
      push: {
        title: (payload) =>
          payload?.verdict === "VALID"
            ? "✅ Tvé nahlášení bylo potvrzeno"
            : "ℹ️ Tvé nahlášení bylo zamítnuto",
        body: (payload) =>
          payload?.verdict === "VALID"
            ? payload?.wasPaid
              ? "Sdílení jsme po kontrole vyhodnotili jako neplatné. Odměna už byla zaplacena, ale zákazníkovi jsme snížili hodnocení."
              : "Sdílení jsme po kontrole vyhodnotili jako neplatné. Nebudeš za něj platit."
            : payload?.wasPaid
              ? "Tvé nahlášení jsme posoudili a vyhodnotili jako neoprávněné. Sdílení je zaplacené."
              : "Tvé nahlášení jsme posoudili a vyhodnotili jako neoprávněné. Sdílení bude zaplaceno.",
        data: (payload) => ({
          screen: "share-details",
          uid: payload?.shareUid,
        }),
      },
    },
  },
  "a.account.visibility-change": {
    showCta: true,
    en: {
      push: {
        title: (payload) =>
          payload?.visible
            ? "🎉 Your business is now visible on Tagly"
            : "⚠️ Your business is no longer visible on Tagly",
        body: (payload) => {
          if (payload?.visible) {
            return "Customers can now find and share you. Open the app to see how your profile looks.";
          }
          switch (payload?.cause) {
            case "negativeBalance":
              return "Your balance is negative. Pay it off in the app to get shared again.";
            case "paygRemoved":
              return "Pay as you go is off. Add credits or relink a card to get shared again.";
            case "lowBalance":
              return "You're out of credits. Top up to get found and shared again.";
            default:
              return "Customers can't find or share your business right now. Open the app to see why.";
          }
        },
        data: (payload) => (payload?.visible ? {} : { screen: "credits" }),
      },
      email: {
        subject: (payload) =>
          payload?.visible
            ? "Your business is now visible on Tagly"
            : "Your business is no longer visible on Tagly",
        title: (payload) =>
          payload?.visible
            ? "Your business is visible"
            : "Your business is no longer visible",
        preheader: (payload) =>
          payload?.visible
            ? "Customers can now find and share your business."
            : "See why and how to get visible again.",
        html: (payload) => {
          if (payload?.visible) {
            return [
              "<p>Good news! Your business is now visible to Tagly customers. They can find and share it.</p>",
              "<p>Check how your profile looks to customers.</p>",
            ].join("");
          }
          const reason =
            payload?.cause === "negativeBalance"
              ? "<p><strong>Why:</strong> a share reward was paid out that your balance didn't cover, so it's negative. Your business stays hidden until the balance is paid off.</p><p>Pay off the balance to bring it back to zero. You may also need to add credits or relink a card to become visible again.</p>"
              : payload?.cause === "paygRemoved"
                ? "<p><strong>Why:</strong> pay as you go is off and your credit balance is below the minimum.</p><p>Add credits or relink a card to get found and shared again.</p>"
                : payload?.cause === "lowBalance"
                  ? "<p><strong>Why:</strong> your credit balance dropped below the minimum.</p><p>Top up your credits to get found and shared again.</p>"
                  : "<p>The app shows the reason and the way back.</p>";
          return (
            "<p>Your business is no longer visible to Tagly customers.</p>" +
            reason
          );
        },
      },
    },
    cs: {
      push: {
        title: (payload) =>
          payload?.visible
            ? "🎉 Tvůj podnik je teď na Tagly viditelný"
            : "⚠️ Tvůj podnik už není na Tagly viditelný",
        body: (payload) => {
          if (payload?.visible) {
            return "Zákazníci tě teď můžou najít a sdílet. Mrkni, jak tvůj profil vypadá.";
          }
          switch (payload?.cause) {
            case "negativeBalance":
              return "Tvůj zůstatek je záporný. Vyrovnej ho v aplikaci, ať tě zákazníci můžou zase sdílet.";
            case "paygRemoved":
              return "Průběžné platby jsou vypnuté. Kup si kredity nebo znovu připoj kartu, ať tě zákazníci můžou sdílet.";
            case "lowBalance":
              return "Došly ti kredity. Dobij si je, ať tě zákazníci zase najdou a sdílí.";
            default:
              return "Zákazníci teď nemůžou tvůj podnik najít ani sdílet. Otevři aplikaci a zjisti proč.";
          }
        },
        data: (payload) => (payload?.visible ? {} : { screen: "credits" }),
      },
      email: {
        subject: (payload) =>
          payload?.visible
            ? "Tvůj podnik je teď na Tagly viditelný"
            : "Tvůj podnik už není na Tagly viditelný",
        title: (payload) =>
          payload?.visible
            ? "Tvůj podnik je viditelný"
            : "Tvůj podnik už není viditelný",
        preheader: (payload) =>
          payload?.visible
            ? "Zákazníci teď můžou tvůj podnik najít a sdílet."
            : "Zjisti proč a jak být zase viditelný.",
        html: (payload) => {
          if (payload?.visible) {
            return [
              "<p>Dobrá zpráva! Tvůj podnik je teď na Tagly viditelný. Zákazníci ho můžou najít a sdílet.</p>",
              "<p>Mrkni, jak tvůj profil vypadá pro zákazníky.</p>",
            ].join("");
          }
          const reason =
            payload?.cause === "negativeBalance"
              ? "<p><strong>Proč:</strong> za sdílení jsme zaplatili odměnu, kterou tvůj zůstatek nepokryl, takže je záporný. Tvůj podnik zůstane skrytý, dokud zůstatek nevyrovnáš.</p><p>Vyrovnej zůstatek zpět na nulu. Aby byl tvůj podnik znovu viditelný, možná bude potřeba také přidat kredity nebo znovu připojit kartu.</p>"
              : payload?.cause === "paygRemoved"
                ? "<p><strong>Proč:</strong> průběžné platby jsou vypnuté a tvůj zůstatek kreditů je pod minimem.</p><p>Kup si kredity nebo znovu připoj kartu, ať tě zákazníci zase najdou a sdílí.</p>"
                : payload?.cause === "lowBalance"
                  ? "<p><strong>Proč:</strong> tvůj zůstatek kreditů klesl pod minimum.</p><p>Dobij si kredity, ať tě zákazníci zase najdou a sdílí.</p>"
                  : "<p>V aplikaci najdeš důvod i cestu zpět.</p>";
          return "<p>Tvůj podnik už není pro zákazníky viditelný.</p>" + reason;
        },
      },
    },
  },
  "a.business.banned": {
    en: {
      push: {
        title: "🚫 Your business page was banned",
        body: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : `${payload?.businessName ?? "One of your business pages"} was banned by our team.`,
      },
      email: {
        subject: "Your business page on Tagly was banned",
        title: () => "Your business page was banned",
        preheader: (payload) =>
          payload?.reason
            ? `Reason: ${payload.reason}`
            : "One of your business pages was banned by our team.",
        html: (payload) =>
          [
            `<p>Your business page${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""} on Tagly was banned by our team. It is hidden from customers and can no longer be shared or edited.</p>`,
            payload?.reason
              ? `<p><strong>Reason:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            "<p>Shares that were already posted will still be settled.</p>",
            `<p>If you believe this was a mistake, please contact us at <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "🚫 Tvá stránka podniku byla zablokována",
        body: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : `Tvou stránku ${payload?.businessName ?? "podniku"} zablokoval náš tým.`,
      },
      email: {
        subject: "Tvá stránka podniku na Tagly byla zablokována",
        title: () => "Tvá stránka podniku byla zablokována",
        preheader: (payload) =>
          payload?.reason
            ? `Důvod: ${payload.reason}`
            : "Jednu z tvých stránek podniku zablokoval náš tým.",
        html: (payload) =>
          [
            `<p>Tvou stránku podniku${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""} na Tagly zablokoval náš tým. Je skrytá před zákazníky a nejde ji sdílet ani upravovat.</p>`,
            payload?.reason
              ? `<p><strong>Důvod:</strong> ${escapeEmailHtml(payload.reason)}</p>`
              : "",
            "<p>Zveřejněná sdílení budou normálně zaplacena.</p>",
            `<p>Pokud si myslíš, že došlo k chybě, kontaktuj prosím naši podporu na <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>.</p>`,
          ].join(""),
      },
    },
  },
  "a.business.unbanned": {
    showCta: true,
    en: {
      push: {
        title: "✅ Your business page was restored",
        body: (payload) =>
          `${payload?.businessName ?? "Your business page"} is no longer banned. With active funding it will be visible to customers again.`,
      },
      email: {
        subject: "Your business page on Tagly was restored",
        title: () => "Your business page was restored",
        preheader: () => "Your business page is no longer banned.",
        html: (payload) =>
          [
            `<p>Good news! Your business page${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""} on Tagly is no longer banned.</p>`,
            "<p>With active funding it will be visible and shareable to customers again.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "✅ Tvá stránka podniku byla obnovena",
        body: (payload) =>
          `Tvá stránka ${payload?.businessName ?? "podniku"} už není zablokovaná. S aktivním financováním ji zákazníci zase uvidí.`,
      },
      email: {
        subject: "Tvá stránka podniku na Tagly byla obnovena",
        title: () => "Tvá stránka podniku byla obnovena",
        preheader: () => "Tvá stránka podniku už není zablokovaná.",
        html: (payload) =>
          [
            `<p>Dobrá zpráva! Tvá stránka podniku${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""} na Tagly už není zablokovaná.</p>`,
            "<p>S aktivním financováním ji zákazníci zase uvidí a můžou ji sdílet.</p>",
          ].join(""),
      },
    },
  },
  "a.business.assigned": {
    showCta: true,
    en: {
      push: {
        title: "🎉 A business page was added to your account",
        body: (payload) =>
          `${payload?.businessName ?? "A business page"} is now managed from your account. Open the app to check it.`,
      },
      email: {
        subject: "A business page was added to your Tagly account",
        title: () => "A business page was added to your account",
        preheader: (payload) =>
          `${payload?.businessName ?? "A business page"} is now managed from your account.`,
        html: (payload) =>
          [
            `<p>Our team assigned the business page${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""} to your Tagly account.</p>`,
            "<p>You can now manage it, edit its details, and fund it.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "🎉 Máš novou stránku podniku",
        body: (payload) =>
          `${payload?.businessName ?? "Stránku podniku"} teď spravuješ ze svého účtu. Mrkni na ni.`,
      },
      email: {
        subject: "Přiřadili jsme ti stránku podniku",
        title: () => "Máš novou stránku podniku",
        preheader: (payload) =>
          `${payload?.businessName ?? "Stránku podniku"} teď spravuješ ze svého účtu.`,
        html: (payload) =>
          [
            `<p>Náš tým ti k účtu Tagly přiřadil stránku podniku${payload?.businessName ? ` <strong>${escapeEmailHtml(payload.businessName)}</strong>` : ""}.</p>`,
            "<p>Teď ji můžeš spravovat, upravovat její údaje a financovat.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.credit-purchase-refunded": {
    showCta: true,
    en: {
      push: {
        title: "💳 A credit purchase was refunded",
        body: () =>
          "Your credit purchase was refunded. Check your updated balance.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "A Tagly credit purchase was refunded",
        title: () => "Your credit purchase was refunded",
        preheader: () =>
          "Stripe refunded your credit purchase. Your Tagly credits have been adjusted.",
        html: () =>
          [
            "<p>A previous credit purchase on Tagly was refunded by Stripe. Your balance has been adjusted.</p>",
            "<p>You may also receive a separate confirmation from Stripe.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "💳 Platba za kredity byla vrácena",
        body: () => "Platba za kredity se ti vrátila. Mrkni na svůj zůstatek.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "Platba za kredity na Tagly byla vrácena",
        title: () => "Tvoje platba za kredity byla vrácena",
        preheader: () =>
          "Stripe vrátil tvoji platbu za kredity. Tvé kredity na Tagly byly upraveny.",
        html: () =>
          [
            "<p>Stripe ti vrátil dřívější platbu za kredity na Tagly a tvůj zůstatek jsme podle toho upravili.</p>",
            "<p>Od Stripu ti může přijít i samostatné potvrzení.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.credit-purchase-failed": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Your credit purchase failed",
        body: () =>
          "Stripe couldn't complete your payment. Check your payment method and try again.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "Your credit purchase didn't go through",
        title: () => "Your payment didn't go through",
        preheader: () =>
          "Stripe couldn't complete your credit purchase. No credits were added to your Tagly balance.",
        html: () =>
          [
            "<p>Your recent credit purchase couldn't be completed. Stripe wasn't able to charge your payment method, so no credits were added to your balance.</p>",
            "<p>Check your payment details or try a different payment method.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Tvoje platba za kredity se nezdařila",
        body: () =>
          "Platba neprošla. Zkontroluj si platební metodu a zkus to znovu.",
        data: () => ({ screen: "credits" }),
      },
      email: {
        subject: "Tvoje platba za kredity neprošla",
        title: () => "Tvoje platba neprošla",
        preheader: () =>
          "Platba za kredity neprošla, žádné kredity jsme nepřipsali.",
        html: () =>
          [
            "<p>Poslední platba za kredity neprošla. Stripe nemohl částku strhnout z tvé karty, takže jsme žádné kredity nepřipsali.</p>",
            "<p>Zkontroluj si platební údaje nebo zkus jinou kartu.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.payg-charge-failed": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Pay-as-you-go paused",
        body: () =>
          "We couldn't charge your card, so pay-as-you-go was paused. Update your card to resume.",
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: "Pay-as-you-go paused. Update your card to resume.",
        title: () => "We couldn't charge your card",
        preheader: () =>
          "Pay-as-you-go was paused because a card charge failed. Update your card to resume.",
        html: () =>
          [
            "<p>We tried to charge your card for a recent share but the payment didn't go through, so pay-as-you-go has been paused. Your business won't appear as shareable until it's back on.</p>",
            "<p>Update your card to turn pay-as-you-go back on. Any shares already posted will still be paid.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Průběžné platby jsou pozastavené",
        body: () =>
          "Platba z tvé karty neprošla, proto jsme průběžné platby pozastavili. Aktualizuj kartu a zase je zapneš.",
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: "Průběžné platby jsou pozastavené. Aktualizuj si kartu.",
        title: () => "Platba z tvé karty neprošla",
        preheader: () =>
          "Průběžné platby jsme pozastavili, protože platba kartou neprošla.",
        html: () =>
          [
            "<p>Za nedávné sdílení jsme zkusili strhnout platbu z tvé karty, ale neprošla. Průběžné platby jsme proto pozastavili a zákazníci tvůj podnik zatím nemůžou sdílet.</p>",
            "<p>Aktualizuj kartu a průběžné platby zase zapni. Zveřejněná sdílení budou i tak zaplacena.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.monthly-budget-charged": {
    showCta: true,
    en: {
      push: {
        title: "💳 Credits topped up",
        body: (payload) =>
          payload?.amountFormatted
            ? `We charged your card ${payload.amountFormatted} and topped your credits up to ${payload.targetFormatted ?? "your monthly amount"}.`
            : `We topped your credits up to ${payload?.targetFormatted ?? "your monthly amount"}.`,
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: (payload) =>
          `Monthly top-up: your credits are back at ${payload?.targetFormatted ?? "your target"}`,
        title: (payload) =>
          `Credits topped up to ${escapeEmailHtml(payload?.targetFormatted ?? "your target")}`,
        preheader: (payload) =>
          `We charged your saved card ${payload?.amountFormatted ?? ""} as part of your monthly top-up.`,
        html: (payload) =>
          [
            `<p>As part of your monthly top-up, we charged your saved card <strong>${escapeEmailHtml(payload?.amountFormatted ?? "")}</strong> and topped your available credits up to <strong>${escapeEmailHtml(payload?.targetFormatted ?? "")}</strong>.</p>`,
            "<p>You can change or turn off your monthly top-up any time in the Wallet tab.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "💳 Kredity dobity",
        body: (payload) =>
          payload?.amountFormatted
            ? `Z tvé karty jsme strhli ${payload.amountFormatted} a dobili kredity na ${payload.targetFormatted ?? "tvou nastavenou částku"}.`
            : `Dobili jsme ti kredity na ${payload?.targetFormatted ?? "tvou nastavenou částku"}.`,
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: (payload) =>
          `Měsíční dobíjení: dobili jsme ti kredity na ${payload?.targetFormatted ?? "cílovou částku"}`,
        title: (payload) =>
          `Kredity dobity na ${escapeEmailHtml(payload?.targetFormatted ?? "cílovou částku")}`,
        preheader: (payload) =>
          `V rámci měsíčního dobíjení jsme z tvé uložené karty strhli ${payload?.amountFormatted ?? ""}.`,
        html: (payload) =>
          [
            `<p>V rámci měsíčního dobíjení jsme z tvé uložené karty strhli <strong>${escapeEmailHtml(payload?.amountFormatted ?? "")}</strong> a dobili tvé dostupné kredity na <strong>${escapeEmailHtml(payload?.targetFormatted ?? "")}</strong>.</p>`,
            "<p>Měsíční dobíjení můžeš kdykoli upravit nebo vypnout v Peněžence.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.monthly-budget-failed": {
    showCta: true,
    en: {
      push: {
        title: "⚠️ Monthly top-up paused",
        body: () =>
          "We couldn't charge your card, so your monthly top-up was paused. Update your card to turn it back on.",
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: "Monthly top-up paused. Update your card to resume.",
        title: () => "We couldn't charge your card",
        preheader: () =>
          "Your monthly top-up was paused because a card charge failed. Update your card to resume.",
        html: () =>
          [
            "<p>We tried to charge your saved card for this month's top-up, but the payment didn't go through after several attempts, so your monthly top-up has been paused.</p>",
            "<p>Update your card in the app and turn the monthly top-up back on. Your existing credits are unaffected.</p>",
          ].join(""),
      },
    },
    cs: {
      push: {
        title: "⚠️ Měsíční dobíjení je pozastavené",
        body: () =>
          "Platba z tvé karty neprošla, proto jsme měsíční dobíjení museli pozastavit. Aktualizuj kartu a znovu ho zapni.",
        data: () => ({ screen: "billing" }),
      },
      email: {
        subject: "Měsíční dobíjení je pozastavené. Aktualizuj si kartu.",
        title: () => "Platba z tvé karty neprošla",
        preheader: () =>
          "Měsíční dobíjení jsme pozastavili, protože platba kartou neprošla.",
        html: () =>
          [
            "<p>Zkusili jsme z tvé uložené karty strhnout částku za měsíční dobití kreditů, ale platba ani po několika pokusech neprošla. Měsíční dobíjení jsme proto pozastavili.</p>",
            "<p>Aktualizuj kartu v aplikaci a měsíční dobíjení zase zapni. Tvé stávající kredity zůstávají beze změny.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.monthly-budget-upcoming": {
    showCta: true,
    en: {
      email: {
        subject: (payload) =>
          `Reminder: your monthly top-up is on ${formatNoticeDate(payload?.chargeDate, "en")}`,
        title: () => "Your monthly top-up is coming up",
        preheader: (payload) =>
          `On ${formatNoticeDate(payload?.chargeDate, "en")} we'll top your credits back up to ${payload?.targetFormatted ?? "your monthly amount"}.`,
        html: (payload) =>
          [
            `<p>On <strong>${escapeEmailHtml(formatNoticeDate(payload?.chargeDate, "en"))}</strong> we'll top your credits back up to <strong>${escapeEmailHtml(payload?.targetFormatted ?? "")}</strong>.</p>`,
            `<p>Based on your current Tagly balance, that's about <strong>${escapeEmailHtml(payload?.estimatedFormatted ?? "")}</strong> charged to your saved card.</p>`,
            "<p>To change the amount or turn the top-up off, adjust your monthly top-up in the Wallet tab before then.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: (payload) =>
          `Připomínka: ${formatNoticeDate(payload?.chargeDate, "cs")} ti dobijeme kredity`,
        title: () => "Blíží se měsíční dobití kreditů",
        preheader: (payload) =>
          `Dne ${formatNoticeDate(payload?.chargeDate, "cs")} dobijeme tvé kredity na ${payload?.targetFormatted ?? "nastavenou částku"}.`,
        html: (payload) =>
          [
            `<p>Dne <strong>${escapeEmailHtml(formatNoticeDate(payload?.chargeDate, "cs"))}</strong> dobijeme tvé kredity na <strong>${escapeEmailHtml(payload?.targetFormatted ?? "")}</strong>.</p>`,
            `<p>S aktuálním zůstatkem v Tagly to bude přibližně <strong>${escapeEmailHtml(payload?.estimatedFormatted ?? "")}</strong> z tvé uložené karty.</p>`,
            "<p>Pokud chceš částku změnit nebo dobíjení vypnout, uprav měsíční dobíjení v Peněžence před tímto datem.</p>",
          ].join(""),
      },
    },
  },
  "a.balance.promo-credit": {
    showCta: true,
    en: {
      push: {
        title: "🎁 You got free credits",
        body: (payload) =>
          payload?.amountFormatted
            ? `Our team added ${payload.amountFormatted} in promotional credits to your balance.`
            : "Our team added promotional credits to your balance.",
        data: () => ({ screen: "credits" }),
      },
    },
    cs: {
      push: {
        title: "🎁 Dostal/a jsi od nás kredity",
        body: (payload) =>
          payload?.amountFormatted
            ? `Náš tým ti přidal na zůstatek kredity zdarma v hodnotě ${payload.amountFormatted}.`
            : "Náš tým ti přidal na zůstatek kredity zdarma.",
        data: () => ({ screen: "credits" }),
      },
    },
  },
  "a.security.email-change": {
    en: {
      email: {
        subject: "Your Tagly Partner email address was changed",
        title: () => "Your Tagly Partner email was updated",
        preheader: () =>
          "If this wasn't you, reply to this email or contact support immediately.",
        html: () =>
          [
            "<p>We're letting you know that the email address on your Tagly Partner account was recently changed.</p>",
            "<p>If you made this change, you don't need to do anything.</p>",
            `<p>If this wasn't you, please reply to this email or contact us at <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a> immediately so we can help recover your account.</p>`,
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Na tvém účtu Tagly Partner se změnil e-mail",
        title: () => "Změna e-mailu na tvém účtu",
        preheader: () =>
          "Pokud tato změna není od tebe, odpověz na tento e-mail nebo okamžitě kontaktuj naši podporu.",
        html: () =>
          [
            "<p>Na tvém účtu Tagly Partner se nedávno změnila e-mailová adresa.</p>",
            "<p>Pokud je tato změna od tebe, nemusíš nic dělat.</p>",
            `<p>Pokud tato změna není od tebe, prosím odpověz na tento e-mail nebo okamžitě kontaktuj naši podporu na <a href="mailto:${CONTACT.SUPPORT_EMAIL}">${CONTACT.SUPPORT_EMAIL}</a>, abychom ti pomohli obnovit účet.</p>`,
          ].join(""),
      },
    },
  },
  "a.legal.tos-updated": {
    en: {
      email: {
        subject: "We've updated the Tagly Terms of Service",
        title: () => "Tagly Terms of Service update",
        preheader: () =>
          "Review the updated Terms of Service before opening the app.",
        html: () =>
          [
            "<p>We've updated the Tagly Terms of Service.</p>",
            '<p>You can review the latest version any time at <a href="https://www.taglyapp.com/terms-of-service" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-service</a>.</p>',
            "<p>The next time you open the Tagly Partner app, you may be asked to review and agree to the updated terms.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Aktualizovali jsme Obchodní podmínky Tagly",
        title: () => "Aktualizace Obchodních podmínek Tagly",
        preheader: () =>
          "Prohlédni si aktualizované Obchodní podmínky, než otevřeš aplikaci.",
        html: () =>
          [
            "<p>Aktualizovali jsme Obchodní podmínky Tagly.</p>",
            '<p>Aktuální verzi si můžeš kdykoli prohlédnout na <a href="https://www.taglyapp.com/terms-of-service" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/terms-of-service</a>.</p>',
            "<p>Až příště otevřeš aplikaci Tagly Partner, možná tě poprosíme o souhlas s aktualizovanými podmínkami.</p>",
          ].join(""),
      },
    },
  },
  "a.legal.pp-updated": {
    en: {
      email: {
        subject: "We've updated the Tagly Privacy Policy",
        title: () => "Tagly Privacy Policy update",
        preheader: () =>
          "We've made changes to how we describe the use and protection of your data.",
        html: () =>
          [
            "<p>We've updated the Tagly Privacy Policy.</p>",
            '<p>You can review the latest version any time at <a href="https://www.taglyapp.com/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/privacy-policy</a>.</p>',
            "<p>The next time you open the Tagly Partner app, you may be asked to review and acknowledge the updated policy.</p>",
          ].join(""),
      },
    },
    cs: {
      email: {
        subject: "Aktualizovali jsme Zásady ochrany osobních údajů Tagly",
        title: () => "Aktualizace Zásad ochrany osobních údajů Tagly",
        preheader: () =>
          "Provedli jsme změny v tom, jak popisujeme použití a ochranu tvých údajů.",
        html: () =>
          [
            "<p>Aktualizovali jsme Zásady ochrany osobních údajů Tagly.</p>",
            '<p>Aktuální verzi si můžeš kdykoli prohlédnout na <a href="https://www.taglyapp.com/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.taglyapp.com/privacy-policy</a>.</p>',
            "<p>Až příště otevřeš aplikaci Tagly Partner, možná tě poprosíme o potvrzení aktualizovaných zásad.</p>",
          ].join(""),
      },
    },
  },
} as const satisfies Record<
  NotificationEventSlug,
  LocalizedTransactionalTemplate
>;

export type TransactionalTemplateSlug = keyof typeof transactionalTemplates;
