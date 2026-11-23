import { idxBy } from "../idxBy";
import type { Localized } from "../types";
import { type AccountType, type NotificationChannel } from "../../core/enums";

// User-configurable notification events shown in the in-app settings.
// Categories + display copy live in the shared catalog; push/email templates
// (rendering logic) live in the backend. The backend validates at startup
// that every slug here has a matching template (see seedNotifications).
//
// Scope: transactional only. Promo and admin events are scheduling-driven
// or one-off blasts — not user-configurable — so their slugs stay backend-side.

// The slug union is declared explicitly (not inferred from the array literal)
// so the keys of `transactionalTemplates` can use it as a Record key constraint
// — `Extract<S, "c.${string}">` collapses to `never` if S is `string`, which
// silently breaks every `c.*` / `a.*` event slug downstream.
export type NotificationEventSlug =
  // CUSTOMER
  | "c.shares.rated"
  | "c.shares.rejected"
  | "c.shares.unpayable"
  | "c.account.multiplier-updated"
  | "c.account.payouts-enabled"
  | "c.account.payouts-disabled"
  | "c.account.banned"
  | "c.account.unbanned"
  | "c.balance.share-payout"
  | "c.balance.withdrawal-failed"
  | "c.balance.withdrawal-completed"
  | "c.balance.withdrawal-reversed"
  | "c.security.email-change"
  | "c.legal.tos-updated"
  | "c.legal.pp-updated"
  | "c.legal.tom-updated"
  // ADVERTISER
  | "a.shares.created"
  | "a.shares.report-updated"
  | "a.reminders.low-balance"
  | "a.account.visibility-change"
  | "a.business.banned"
  | "a.business.unbanned"
  | "a.business.assigned"
  | "a.balance.promo-credit"
  | "a.balance.credit-purchase-refunded"
  | "a.balance.credit-purchase-failed"
  | "a.balance.payg-charge-failed"
  | "a.balance.monthly-budget-charged"
  | "a.balance.monthly-budget-failed"
  | "a.balance.monthly-budget-upcoming"
  | "a.security.email-change"
  | "a.legal.tos-updated"
  | "a.legal.pp-updated";

export type NotificationEventDef = {
  slug: NotificationEventSlug;
  categorySlug: string;
  target: AccountType;
  label: Localized;
  description: Localized;
  availableChannels: NotificationChannel[];
  mandatoryChannels?: NotificationChannel[];
  sortOrder?: number;
};

export const notificationEvents: NotificationEventDef[] = [
  // -------- CUSTOMER --------
  {
    slug: "c.shares.rated",
    categorySlug: "shares",
    target: "CUSTOMER",
    label: { en: "Share rated", cs: "Sdílení ohodnoceno" },
    description: {
      en: "Get notified when your share is rated.",
      cs: "Dej mi vědět, až budou moje sdílení ohodnocena.",
    },
    availableChannels: ["PUSH"],
  },
  {
    slug: "c.shares.rejected",
    categorySlug: "shares",
    target: "CUSTOMER",
    label: { en: "Share rejected", cs: "Sdílení zamítnuto" },
    description: {
      en: "When an admin rejects one of your shares during review.",
      cs: "Když správce při kontrole zamítne jedno z tvých sdílení.",
    },
    //  email is mandatory — the customer must always be told a
    // share was rejected
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },
  {
    slug: "c.shares.unpayable",
    categorySlug: "shares",
    target: "CUSTOMER",
    label: { en: "Share can't be paid", cs: "Sdílení nelze zaplatit" },
    description: {
      en: "When a share can no longer be verified and won't be paid.",
      cs: "Když už sdílení nejde ověřit a nebude zaplaceno.",
    },
    // Push-only by design: no action to take and not the customer's fault —
    // an email would turn a minor disappointment into inbox noise.
    availableChannels: ["PUSH"],
    sortOrder: 4,
  },
  {
    slug: "c.account.payouts-enabled",
    categorySlug: "account",
    target: "CUSTOMER",
    label: { en: "Payouts enabled", cs: "Výběry peněz zapnuty" },
    description: {
      en: "When your payout account is approved and ready.",
      cs: "Když je tvůj účet na výběr peněz schválený a připravený.",
    },
    // Push-only by design (decided 2026-07-25): its value is the async case
    // where Stripe verification finishes hours later — a push unlock suffices;
    // an email receipt for good news is noise. (payouts-disabled keeps its
    // mandatory email — that one requires action.)
    availableChannels: ["PUSH"],
    sortOrder: 1,
  },
  {
    slug: "c.account.payouts-disabled",
    categorySlug: "account",
    target: "CUSTOMER",
    label: { en: "Payouts disabled", cs: "Výběry peněz pozastaveny" },
    description: {
      en: "If payouts are temporarily disabled on your account.",
      cs: "Když jsou výběry peněz na tvém účtu dočasně pozastaveny.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 2,
  },
  {
    slug: "c.account.banned",
    categorySlug: "account",
    target: "CUSTOMER",
    label: { en: "Account banned", cs: "Účet zablokován" },
    description: {
      en: "If your account is banned.",
      cs: "Když je tvůj účet zablokován.",
    },
    // Push is available (default-on), but EMAIL is mandatory and can't be
    // turned off — the customer must always be told.
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },
  {
    slug: "c.account.unbanned",
    categorySlug: "account",
    target: "CUSTOMER",
    label: { en: "Account restored", cs: "Účet obnoven" },
    description: {
      en: "If your account is restored after a ban.",
      cs: "Když je tvůj účet po zablokování obnoven.",
    },
    // Push is available (default-on), but EMAIL is mandatory and can't be
    // turned off — the customer must always be told.
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 4,
  },
  {
    slug: "c.account.multiplier-updated",
    categorySlug: "account",
    target: "CUSTOMER",
    label: { en: "Rating updated", cs: "Hodnocení upraveno" },
    description: {
      en: "When our team adjusts your account rating.",
      cs: "Když náš tým upraví hodnocení tvého účtu.",
    },
    availableChannels: ["PUSH"],
    sortOrder: 5,
  },
  {
    slug: "c.balance.share-payout",
    categorySlug: "balance",
    target: "CUSTOMER",
    label: { en: "Share payout", cs: "Zisk za sdílení" },
    description: {
      en: "When you earn money for sharing.",
      cs: "Když získáš peníze za sdílení.",
    },
    availableChannels: ["PUSH"],
    sortOrder: 1,
  },
  {
    slug: "c.balance.withdrawal-failed",
    categorySlug: "balance",
    target: "CUSTOMER",
    label: { en: "Withdrawal failed", cs: "Výběr peněz se nezdařil" },
    description: {
      en: "If a withdrawal can't be completed.",
      cs: "Když nelze dokončit výběr peněz.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },
  {
    slug: "c.balance.withdrawal-completed",
    categorySlug: "balance",
    target: "CUSTOMER",
    label: { en: "Withdrawal completed", cs: "Výběr peněz dokončen" },
    description: {
      en: "When your withdrawal finishes.",
      cs: "Když je výběr peněz dokončen.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    sortOrder: 4,
  },
  {
    slug: "c.balance.withdrawal-reversed",
    categorySlug: "balance",
    target: "CUSTOMER",
    label: { en: "Withdrawal returned", cs: "Výběr peněz vrácen" },
    description: {
      en: "If a withdrawal is returned to your Tagly balance.",
      cs: "Když se výběr peněz vrátí na tvůj zůstatek Tagly.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    sortOrder: 5,
  },
  {
    slug: "c.security.email-change",
    categorySlug: "security",
    target: "CUSTOMER",
    label: { en: "Email change", cs: "Změna e-mailu" },
    description: {
      en: "Confirmation when your account email changes.",
      cs: "Potvrzení, když se změní e-mail na tvém účtu.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
  },
  {
    slug: "c.legal.tos-updated",
    categorySlug: "legal",
    target: "CUSTOMER",
    label: {
      en: "Terms of Service update",
      cs: "Aktualizace Obchodních podmínek",
    },
    description: {
      en: "Important changes to the Terms of Service.",
      cs: "Důležité změny Obchodních podmínek.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 1,
  },
  {
    slug: "c.legal.pp-updated",
    categorySlug: "legal",
    target: "CUSTOMER",
    label: {
      en: "Privacy Policy update",
      cs: "Aktualizace Zásad ochrany osobních údajů",
    },
    description: {
      en: "Updates to how we handle your data.",
      cs: "Aktualizace toho, jak nakládáme s tvými údaji.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 2,
  },
  {
    slug: "c.legal.tom-updated",
    categorySlug: "legal",
    target: "CUSTOMER",
    label: {
      en: "Terms of Monetization update",
      cs: "Aktualizace Podmínek monetizace",
    },
    description: {
      en: "Changes to monetization terms.",
      cs: "Změny Podmínek monetizace.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },

  // -------- ADVERTISER --------
  {
    slug: "a.shares.created",
    categorySlug: "shares",
    target: "ADVERTISER",
    label: { en: "Share created", cs: "Někdo tě sdílel" },
    description: {
      en: "Get notified when your business is shared.",
      cs: "Dej mi vědět, když někdo sdílí můj podnik.",
    },
    availableChannels: ["PUSH"],
  },
  {
    slug: "a.reminders.low-balance",
    categorySlug: "reminders",
    target: "ADVERTISER",
    label: { en: "Credits running low", cs: "Dochází kredity" },
    description: {
      en: "A heads-up while you're still visible: your credits are running low and customers see your business as ending soon.",
      cs: "Upozornění, dokud jsi ještě viditelný: docházejí ti kredity a zákazníci vidí tvůj podnik jako končící nabídku.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    sortOrder: 5,
  },
  {
    slug: "a.shares.report-updated",
    categorySlug: "shares",
    target: "ADVERTISER",
    label: { en: "Report resolved", cs: "Nahlášení vyřešeno" },
    description: {
      en: "The result when a share you reported is reviewed.",
      cs: "Výsledek kontroly sdílení, které jsi nahlásil/a.",
    },
    availableChannels: ["PUSH"],
    sortOrder: 2,
  },
  {
    slug: "a.account.visibility-change",
    categorySlug: "account",
    target: "ADVERTISER",
    label: { en: "Visibility changes", cs: "Změny viditelnosti" },
    description: {
      en: "When your business becomes visible to Tagly customers or stops being visible, with the reason.",
      cs: "Když se tvůj podnik stane pro uživatele Tagly viditelný nebo viditelný být přestane, včetně důvodu.",
    },
    // EMAIL mandatory — visibility is the business-critical state, and the
    // email carries the reason + the way back. Push is default-on.
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 1,
  },
  {
    slug: "a.business.banned",
    categorySlug: "account",
    target: "ADVERTISER",
    label: { en: "Business page banned", cs: "Stránka podniku zablokována" },
    description: {
      en: "If one of your business pages is banned.",
      cs: "Když je některá z tvých stránek podniku zablokována.",
    },
    // EMAIL mandatory — the owner must always be told their page was banned.
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },
  {
    slug: "a.business.unbanned",
    categorySlug: "account",
    target: "ADVERTISER",
    label: { en: "Business page restored", cs: "Stránka podniku obnovena" },
    description: {
      en: "If one of your business pages is restored after a ban.",
      cs: "Když je některá z tvých stránek podniku po zablokování obnovena.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 4,
  },
  {
    slug: "a.business.assigned",
    categorySlug: "account",
    target: "ADVERTISER",
    label: { en: "Business page assigned", cs: "Stránka podniku přiřazena" },
    description: {
      en: "When our team assigns a business page to your account.",
      cs: "Když náš tým přiřadí stránku podniku k tvému účtu.",
    },
    // EMAIL mandatory — ownership of a page (and the budget responsibility
    // that comes with it) changed hands; the new owner must always be told.
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 5,
  },
  {
    slug: "a.balance.credit-purchase-refunded",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: { en: "Credit purchase refunded", cs: "Platba za kredity vrácena" },
    description: {
      en: "A credit purchase you made was refunded.",
      cs: "Tvoje platba za kredity byla vrácena.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 4,
  },
  {
    slug: "a.balance.credit-purchase-failed",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: {
      en: "Credit purchase failed",
      cs: "Platba za kredity se nezdařila",
    },
    description: {
      en: "Your credit purchase could not be completed.",
      cs: "Tvoje platba za kredity nemohla být dokončena.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 3,
  },
  {
    slug: "a.balance.payg-charge-failed",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: {
      en: "Pay-as-you-go charge failed",
      cs: "Platba v režimu průběžné platby selhala",
    },
    description: {
      en: "We couldn't charge your card, so pay-as-you-go was paused. Update your card to resume.",
      cs: "Nepodařilo se nám stáhnout platbu z tvé karty, proto byla průběžná platba pozastavena. Aktualizuj kartu pro obnovení.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 5,
  },
  {
    slug: "a.balance.monthly-budget-charged",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: {
      en: "Monthly top-up completed",
      cs: "Měsíční dobití proběhlo",
    },
    description: {
      en: "Your monthly receipt: we charged your card and topped your credits up to your monthly amount.",
      cs: "Měsíční potvrzení: strhli jsme platbu z tvé karty a dobili kredity na nastavenou částku.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 6,
  },
  {
    slug: "a.balance.monthly-budget-failed",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: {
      en: "Monthly top-up charge failed",
      cs: "Platba měsíčního dobíjení selhala",
    },
    description: {
      en: "We couldn't charge your card, so your monthly top-up was paused. Update your card to turn it back on.",
      cs: "Nepodařilo se nám stáhnout platbu z tvé karty, proto bylo měsíční dobíjení pozastaveno. Aktualizuj kartu a zase ho zapni.",
    },
    availableChannels: ["PUSH", "EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 7,
  },
  {
    slug: "a.balance.monthly-budget-upcoming",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: {
      en: "Upcoming monthly top-up",
      cs: "Blížící se měsíční dobití",
    },
    description: {
      en: "A reminder a few days before your monthly top-up, with the amount we expect to charge.",
      cs: "Připomínka pár dní před měsíčním dobitím s částkou, kterou plánujeme strhnout.",
    },
    availableChannels: ["EMAIL"],
    sortOrder: 8,
  },
  {
    slug: "a.balance.promo-credit",
    categorySlug: "balance",
    target: "ADVERTISER",
    label: { en: "Promotional credits", cs: "Promo kredity" },
    description: {
      en: "When our team adds promotional credits to your balance.",
      cs: "Když ti náš tým přidá promo kredity do tvého zůstatku.",
    },
    availableChannels: ["PUSH"],
    sortOrder: 7,
  },
  {
    slug: "a.security.email-change",
    categorySlug: "security",
    target: "ADVERTISER",
    label: { en: "Email change", cs: "Změna e-mailu" },
    description: {
      en: "When your account email is updated.",
      cs: "Když je e-mail tvého účtu aktualizován.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
  },
  {
    slug: "a.legal.tos-updated",
    categorySlug: "legal",
    target: "ADVERTISER",
    label: {
      en: "Terms of Service update",
      cs: "Aktualizace Obchodních podmínek",
    },
    description: {
      en: "Review the updated Terms of Service.",
      cs: "Prohlédni si aktualizované Obchodní podmínky.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 1,
  },
  {
    slug: "a.legal.pp-updated",
    categorySlug: "legal",
    target: "ADVERTISER",
    label: {
      en: "Privacy Policy update",
      cs: "Aktualizace Zásad ochrany osobních údajů",
    },
    description: {
      en: "We've updated our privacy practices.",
      cs: "Aktualizovali jsme Zásady ochrany osobních údajů.",
    },
    availableChannels: ["EMAIL"],
    mandatoryChannels: ["EMAIL"],
    sortOrder: 2,
  },
];

export const notificationEventBySlug = idxBy(notificationEvents);
export const notificationEventSlugs = notificationEvents.map((e) => e.slug);
