/**
 * Promo / onboarding notification catalog.
 *
 * Each entry is a discrete scheduling step with its own slug, cadence window,
 * channels, and email/push copy. The maintenance worker iterates this catalog
 * by cadence.kind to determine who to notify and when.
 *
 * Slugs:
 *   pc.promo.complete-registration.*  — PendingCustomers who haven't finished signup
 *   c.promo.first-share.*             — Customers with 0 shares
 *   c.promo.inactivity.*              — Customers who have gone quiet after sharing
 *   a.promo.add-budget.*              — Advertisers who never funded (no credits, no PAYG)
 *
 * There is deliberately NO pending-advertiser sequence. Advertiser onboarding
 * ends `… → notifications → consent → finishing`, and the finishing screen
 * calls `finishRegistration` on mount — so a PendingAdvertiserAccount with
 * consent granted survives for seconds, and the ≥3h cadence windows could
 * never match it. (The pending-CUSTOMER twin below is reachable because
 * consent is followed by the profile + Instagram steps, which are abandonable.)
 * `pa.promo.complete-registration.{h3,h24,h72}` existed until 2026-08-09 and
 * was removed as unreachable; anyone who completes signup is covered from day
 * one by `a.promo.add-budget.d1`.
 *
 * SLUG CONTINUITY — slugs are historical ids, the cadence windows are the truth.
 * The system is live and `PromoNotificationLog` dedupes by slug, so retuning a
 * step's window keeps its slug (nobody mid-sequence gets a repeat) and deleting
 * a step is safe (schedulers iterate this catalog). Concretely:
 *   - `pc.promo.complete-registration.h48` fires at 72h.
 *   - `c.promo.first-share.d2` fires at day 3.
 *   - `c.promo.first-share.{d1,d21,d45,d60}` were deleted in the 2026-07 rework.
 * The advertiser sequences are post-rework additions, so their slugs are honest.
 *
 * All entries must set notificationType: "promo" and cadence.
 * No label or description — promo events have no in-app notification settings.
 *
 * Channel semantics (the waterfall — see PROMO_DELIVERY + the queue util):
 * availableChannels: [PUSH, EMAIL] does NOT double-blast. It means push-first
 * for push-reachable recipients with the email queued 24h behind as a
 * no-engagement escalation (skipped if they open the app in between), and
 * immediate email for everyone else. [PUSH] = push-reachable only; [EMAIL] =
 * email always. All sends are snapped into the recipient's local 8:00–20:00
 * quiet-hours window.
 *
 * Copy comes 1:1 from the reviewed draft (repo root `promo-copy-draft.md`) and
 * follows the voice rules in `tagly-shared/client/i18n/CLAUDE.md`: each language
 * written natively, story is neuter in CS, no "verified story", advertisers
 * are never told their customers "already" post stories, no em dashes.
 *
 * Each entry carries bilingual push/email templates inline:
 *   { ..., en: { push?, email? }, cs: { push?, email? } }
 * The send pipeline picks the variant at send time via recipient language
 * resolution (see pickPromoTemplate in notificationRegistry).
 */

import type {
  PromoEvent,
  PushTemplate,
  EmailTemplate,
} from "./notificationTypes.js";
import { NotificationChannel } from "../../../generated/prisma/client.js";

const { EMAIL, PUSH } = NotificationChannel;

type LocalizedPromoEvent = Omit<PromoEvent, "push" | "email"> & {
  en: { push?: PushTemplate; email?: EmailTemplate };
  cs: { push?: PushTemplate; email?: EmailTemplate };
};

export const promoEventsRaw = {
  // ==============================
  // PendingCustomer — complete registration
  // Measured from PendingCustomer.createdAt.
  // Stops when the Customer record is created (row deleted) or the window ends.
  // ==============================

  "pc.promo.complete-registration.h3": {
    target: "PENDING_CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: {
      kind: "pendingCustomerNudge" as const,
      minHours: 3,
      maxHours: 24,
    },
    en: {
      push: {
        title: "✨ You're one step away",
        body: () =>
          "Finish your profile and start earning for your Instagram stories.",
      },
      email: {
        subject: "Your stories can start paying you",
        preheader: () =>
          "One minute to finish your profile, then your next story can earn.",
        title: () => "Your stories are worth money",
        html: () => `
          <p>That story you posted from brunch last weekend? On Tagly, that's money. Local businesses pay real customers for stories like it, and you're one step from being one of them.</p>
          <p>Finish your profile, then it works like this: pick a spot in the app, go, and post a story like you always do. We verify it automatically and pay you for it.</p>
          <p>Finishing takes about a minute. Your next story could be the first one that pays.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "✨ Zbývá poslední krok",
        body: () =>
          "Dokonči profil a začni vydělávat za svoje Instagram stories.",
      },
      email: {
        subject: "Za svoje stories můžeš dostávat zaplaceno",
        preheader: () => "Dokonči profil, zabere to minutu. Pak stačí dát story.",
        title: () => "Máš to za minutu",
        html: () => `
          <p>Kafe, brunch, večer s kamarády. Stories z toho dáváš tak jako tak, na Tagly za ně můžeš dostat zaplaceno.</p>
          <p>Chybí ti jen poslední krok. Dokonči profil, vyber si podnik v aplikaci, zajdi tam a dej story jako vždycky. My story ověříme a peníze ti připíšeme na účet v Tagly.</p>
          <p>Dokončení zabere minutu. Tvoje příští story může být první, co ti něco vydělá.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "pc.promo.complete-registration.h24": {
    target: "PENDING_CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: {
      kind: "pendingCustomerNudge" as const,
      minHours: 24,
      maxHours: 72,
    },
    en: {
      push: {
        title: "⏳ Still one step away",
        body: () =>
          "One minute to finish your profile, then your stories can start paying.",
      },
      email: {
        subject: "The stories you already post can make you money",
        preheader: () =>
          "Same places, same stories. The only new thing is the payout.",
        title: () => "You already do the hard part",
        html: () => `
          <p>Going out and posting stories is something you already do. The only thing Tagly adds is the money: pick the spot in the app, post like always, get paid.</p>
          <p>No follower minimum, no scripts, nothing to create that you wouldn't post anyway.</p>
          <p>Your profile is one minute from finished. After that, your next story can pay.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "⏳ Minuta a máš to",
        body: () => "Dokonči profil a za svoje stories můžeš dostávat zaplaceno.",
      },
      email: {
        subject: "Peníze za stories, co stejně dáváš",
        preheader: () =>
          "Stejné podniky, stejné stories. Nově za ně dostaneš zaplaceno.",
        title: () => "Všechno už vlastně děláš",
        html: () => `
          <p>Chodíš ven, dáváš stories. Tagly do toho přidává jediné: peníze. Vybereš si podnik v aplikaci, zajdeš tam, dáš story jako vždycky a dostaneš zaplaceno.</p>
          <p>Žádné minimum sledujících, žádné scénáře, žádné natáčení navíc. Podniky platí normálním lidem za normální stories.</p>
          <p>Profil dokončíš za minutu. Pak už může vydělávat každé story z podniku, který je na Tagly.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // Slug historical: fires at 72h (was 48h before the 2026-07 rework).
  "pc.promo.complete-registration.h48": {
    target: "PENDING_CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: {
      kind: "pendingCustomerNudge" as const,
      minHours: 72,
      maxHours: 168,
    },
    en: {
      push: {
        title: "👋 Last reminder",
        body: () =>
          "No more reminders after this one. Finishing your profile takes a minute.",
      },
      email: {
        subject: "We'll leave you alone after this one",
        preheader: () => "One minute to finish, no deadline, nothing expires.",
        title: () => "Last one, promise",
        html: () => `
          <p>We won't keep filling your inbox. This is the last email about finishing your profile.</p>
          <p>There's no deadline and nothing expires. Whenever it suits you, it takes a minute, and from then on the stories you post can earn.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "👋 Poslední připomenutí",
        body: () => "Dál už tě otravovat nebudeme. Profil dokončíš za minutu.",
      },
      email: {
        subject: "Po tomhle e-mailu už ti dáme pokoj",
        preheader: () =>
          "Žádný termín, nic nepropadá. Dokončení zabere minutu.",
        title: () => "Poslední, slibujeme",
        html: () => `
          <p>Nechceme ti plnit schránku, takže tohle je poslední e-mail k dokončení profilu.</p>
          <p>Nikam to neuteče a nic nepropadá. Až budeš mít chvíli, máš to za minutu. Pak už za svoje stories můžeš dostávat zaplaceno.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // ==============================
  // Customer — first share
  // Measured from Customer.createdAt, only for customers with 0 shares.
  // maxDays = global cutoff — don't nudge customers older than this.
  // ==============================

  // Slug historical: fires at day 3 (was day 2 before the 2026-07 rework).
  "c.promo.first-share.d2": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "firstShareNudge" as const, minDays: 3, maxDays: 7 },
    en: {
      push: {
        title: "🎯 One story from your first payout",
        body: () =>
          "Pick a spot on Tagly, go, post a story. We handle the rest.",
      },
      email: {
        subject: "Your first payout is one story away",
        preheader: () => "Go somewhere on Tagly, post a story, get paid.",
        title: () => "It really is this simple",
        html: () => `
          <p>Pick a spot on Tagly near you, go, and post a story like you always would. We verify it automatically and the money lands in your Tagly balance.</p>
          <p>No scripts, no brand guidelines, no follower minimum. An honest story is exactly what the businesses want.</p>
          <p>Open the map and see what's near you.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "🎯 První odměna za jedno story",
        body: () =>
          "Vyber si podnik na Tagly, zajdi tam a dej story. O zbytek se postaráme.",
      },
      email: {
        subject: "Od první odměny tě dělí jedno story",
        preheader: () => "Zajdi do podniku z Tagly, dej story a dostaň zaplaceno.",
        title: () => "Vážně je to takhle jednoduché",
        html: () => `
          <p>Najdi si na Tagly podnik ve svém okolí, zajdi tam a dej story jako vždycky. My story automaticky ověříme a peníze ti připíšeme na účet v Tagly.</p>
          <p>Žádné scénáře, žádná pravidla, žádný minimální počet sledujících. Podnikům stačí obyčejné story od někoho, kdo tam vážně byl.</p>
          <p>Mrkni na mapu, co je poblíž.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "c.promo.first-share.d7": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "firstShareNudge" as const, minDays: 7, maxDays: 14 },
    en: {
      push: {
        title: "📍 Spots near you pay for stories",
        body: () =>
          "The stories you already post are worth money here. One visit is all it takes.",
      },
      email: {
        subject: "Businesses here pay for exactly what you already post",
        preheader: () => "They don't need influencers. They need locals like you.",
        title: () => "Your stories are exactly what they want",
        html: () => `
          <p>A local cafe doesn't want a celebrity ad. It wants a story from someone who actually came in and is followed by people who live nearby.</p>
          <p>That's you. You post like you always do, locals find out about the place, you get paid.</p>
          <p>Pick a spot on the map and give it a try. The first payout can easily cover the bill.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "📍 Podniky v okolí platí za stories",
        body: () => "Jedna návštěva, jedno story a máš zaplaceno.",
      },
      email: {
        subject: "Podniky v okolí platí i za tvoje stories",
        preheader: () =>
          "Nepotřebují influencery. Stačí jim lidi, co tam vážně chodí.",
        title: () => "Tvoje stories jsou přesně to, co podniky chtějí",
        html: () => `
          <p>Kavárna za rohem nepotřebuje reklamu s celebritou. Mnohem víc jí pomůže story od někoho, kdo tam vážně zašel a koho sledují lidi z okolí.</p>
          <p>Přesně na tomhle Tagly stojí: ty dáš story jako vždycky, lidi z okolí se o podniku dozvědí a ty dostaneš zaplaceno.</p>
          <p>Vyber si na mapě podnik a zkus to. První odměna ti klidně pokryje útratu.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "c.promo.first-share.d14": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "firstShareNudge" as const, minDays: 14, maxDays: 30 },
    en: {
      push: {
        title: "☕ Going out this week?",
        body: () =>
          "Check Tagly first. If the spot is on it, your story gets paid.",
      },
      email: {
        subject: "Next time you're out, open Tagly first",
        preheader: () => "If the spot is on Tagly, your story pays.",
        title: () => "Worth checking before you go",
        html: () => `
          <p>Next time you're heading out for coffee, dinner or drinks, open Tagly first. If the spot is on it, go, post your story, and it pays.</p>
          <p>You're posting these moments anyway. This way some of them come with money.</p>
          <p>The map shows everything around you.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "☕ Až půjdeš na kafe",
        body: () =>
          "Mrkni nejdřív do Tagly. Když je podnik zapojený, dostaneš za story zaplaceno.",
      },
      email: {
        subject: "Až příště někam vyrazíš, mrkni do Tagly",
        preheader: () => "Když je podnik na Tagly, tvoje story vydělává.",
        title: () => "Stačí se podívat, než vyrazíš",
        html: () => `
          <p>Až příště půjdeš na kafe, na večeři nebo na pivo, otevři nejdřív Tagly. Když je podnik zapojený, zajdi tam a dej story. Peníze ti pak přijdou samy od sebe.</p>
          <p>Tyhle stories dáváš stejně. Takhle za ně dostaneš zaplaceno.</p>
          <p>Na mapě uvidíš všechno kolem sebe.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // The first-share goodbye — email only.
  "c.promo.first-share.d30": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL],
    showCta: true,
    cadence: { kind: "firstShareNudge" as const, minDays: 30, maxDays: 45 },
    en: {
      email: {
        subject: "Last email from us",
        preheader: () => "No deadline, nothing expires.",
        title: () => "This is the last one",
        html: () => `
          <p>This is the last email about your first story, promise. There's no deadline and nothing expires.</p>
          <p>Just remember it next time you're out somewhere good: if the spot is on Tagly, one story pays. That's all.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      email: {
        subject: "Poslední e-mail od nás",
        preheader: () => "Žádný termín, nic nepropadá.",
        title: () => "Od nás už máš klid",
        html: () => `
          <p>Tohle je poslední e-mail k prvnímu story, slibujeme. Žádný termín neběží a nic ti nepropadne.</p>
          <p>Jen si na nás vzpomeň, až zase někam vyrazíš. Když bude podnik na Tagly, dostaneš za story zaplaceno. To je celé.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // ==============================
  // Customer — inactivity re-engagement
  // Measured from the customer's most recent Share.createdAt.
  // ==============================

  "c.promo.inactivity.d7": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [PUSH],
    cadence: { kind: "inactivityReminder" as const, minDays: 7, maxDays: 14 },
    en: {
      push: {
        title: "📸 Ready for another one?",
        body: () =>
          "It's been a week since your last story. The spots near you are still paying.",
      },
    },
    cs: {
      push: {
        title: "📸 Co takhle zase někam zajít?",
        body: () =>
          "Už je to týden od posledního story. Podniky v okolí pořád platí.",
      },
    },
  },

  "c.promo.inactivity.d14": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: {
      kind: "inactivityReminder" as const,
      minDays: 14,
      maxDays: 30,
    },
    en: {
      push: {
        title: "💸 Spots near you are still paying",
        body: () => "You know how it works. One visit, one story, one payout.",
      },
      email: {
        subject: "The spots near you are still paying",
        preheader: () => "You've done it before. Visit, post, get paid.",
        title: () => "You know the drill",
        html: () => `
          <p>You've done this before: visit a spot, post a story, get paid. Nothing changed while you were away, the businesses near you are still on Tagly and still paying.</p>
          <p>Open the map and pick your next one.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "💸 Podniky v okolí pořád platí",
        body: () => "Víš, jak to chodí: dáš story, dostaneš zaplaceno.",
      },
      email: {
        subject: "Podniky v okolí pořád platí za stories",
        preheader: () => "Dej story a dostaň zaplaceno, jako minule.",
        title: () => "Víš, jak na to",
        html: () => `
          <p>Znáš to: zajdeš do podniku, dáš story a dostaneš zaplaceno. Mezitím se nic nezměnilo. Podniky v okolí jsou pořád na Tagly a pořád platí.</p>
          <p>Otevři mapu a vyber si, kam zajdeš příště.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "c.promo.inactivity.d30": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL],
    showCta: true,
    cadence: {
      kind: "inactivityReminder" as const,
      minDays: 30,
      maxDays: 60,
    },
    en: {
      email: {
        subject: "A month since your last story",
        preheader: () => "Everything is where you left it.",
        title: () => "No rush",
        html: () => `
          <p>It's been about a month, and that's completely fine. Your account, your history and the paying spots around you are all where you left them.</p>
          <p>Next time you're out, check if the place is on Tagly. One story and you're earning again.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      email: {
        subject: "Měsíc od tvého posledního story",
        preheader: () => "Všechno je jako naposledy. Vrátit se můžeš kdykoli.",
        title: () => "Nikam nespěcháme",
        html: () => `
          <p>Už je to měsíc, ale nic se neděje. Účet, historie i podniky v okolí, všechno máš tam, kde to bylo.</p>
          <p>Až zase někam vyrazíš, mrkni, jestli je podnik na Tagly. Jedno story a zase vyděláváš.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // The inactivity goodbye — email only.
  "c.promo.inactivity.d60": {
    target: "CUSTOMER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL],
    showCta: true,
    cadence: {
      kind: "inactivityReminder" as const,
      minDays: 60,
      maxDays: 90,
    },
    en: {
      email: {
        subject: "Last reminder from us",
        preheader: () => "No more of these. Everything keeps working.",
        title: () => "We'll stop reminding you",
        html: () => `
          <p>This is the last reminder, promise. Your account stays exactly as it is, and stories from spots on Tagly keep paying, today or in six months.</p>
          <p>Whenever you feel like it: visit, post, get paid.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      email: {
        subject: "Poslední připomenutí od nás",
        preheader: () => "Další už nepřijde. Všechno ale funguje dál.",
        title: () => "Už se nebudeme připomínat",
        html: () => `
          <p>Tohle připomenutí je poslední, slibujeme. Tvůj účet zůstává, jak je, a za stories z podniků na Tagly se pořád platí. Dnes stejně jako za půl roku.</p>
          <p>Kdykoli dostaneš chuť: zajdi, dej story, dostaň zaplaceno.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // ==============================
  // Advertiser — add budget
  // Measured from Advertiser.createdAt. Eligibility (scheduler + send-time
  // re-check): NOT funded — no open PAYG period, zero available + locked
  // balance, zero credit purchases ever — AND no PAYG card on file AND promo
  // consent on. Deliberately NOT gated on having a business page (pages are
  // often created by the team from admin with a delay), so the copy never
  // assumes a page exists.
  // ==============================

  "a.promo.add-budget.d1": {
    target: "ADVERTISER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "advertiserAddBudgetNudge" as const, minDays: 1, maxDays: 3 },
    en: {
      push: {
        title: "📣 One step from going live",
        body: () => "Add budget and your part is done. The rest runs by itself.",
      },
      email: {
        subject: "The last step on your side",
        preheader: () => "Add budget and the rest runs on its own.",
        title: () => "Budget is your part",
        html: () => `
          <p>Your account is set up. The one step nobody can do for you is the budget: it's what pays the customers who then share stories about your business.</p>
          <p>Use credits or pay as you go, whichever suits you. No subscription, stop anytime.</p>
          <p>A couple of minutes in the app, and from then on it runs by itself: we calculate the reward for each story and the customer is paid from your budget.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "📣 Krok od spuštění",
        body: () => "Kup si kredity a máš hotovo. Zbytek běží sám.",
      },
      email: {
        subject: "Poslední krok je na tobě",
        preheader: () => "Kup si kredity a zbytek už běží sám.",
        title: () => "Zbývá jen rozpočet",
        html: () => `
          <p>Účet máš připravený. Jediný krok, který za tebe nikdo neudělá, je rozpočet: z něj dostávají zaplaceno zákazníci, kteří o tvém podniku pak sdílí stories.</p>
          <p>Vyber si kredity, nebo průběžné platby. Žádné předplatné a skončit můžeš kdykoli.</p>
          <p>V aplikaci to máš za pár minut. Pak už všechno běží samo: my spočítáme odměnu za každé story a pošleme ji zákazníkovi z tvého rozpočtu.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "a.promo.add-budget.d3": {
    target: "ADVERTISER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "advertiserAddBudgetNudge" as const, minDays: 3, maxDays: 7 },
    en: {
      push: {
        title: "💳 No subscription, no lock-in",
        body: () =>
          "Credits never expire and you only pay when a story actually goes up.",
      },
      email: {
        subject: "How paying on Tagly works",
        preheader: () => "No subscription, nothing monthly, you pay per story.",
        title: () => "You only pay for what actually happens",
        html: () => `
          <p>Credits: load what you want, and they only get spent when a real customer posts a story about your business. We calculate each story's reward, there's no monthly fee, and unspent credits keep waiting.</p>
          <p>Pay as you go: connect a card and pay per story as it happens, nothing upfront.</p>
          <p>Start small and see what it brings you.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "💳 Žádné předplatné, žádný závazek",
        body: () => "Kredity nepropadají a platíš, jen když story opravdu vyjde.",
      },
      email: {
        subject: "Jak se na Tagly platí",
        preheader: () =>
          "Žádné předplatné. Platíš, jen když story opravdu vyjde.",
        title: () => "Platíš jen za to, co se opravdu stane",
        html: () => `
          <p>Kredity: koupíš si, kolik chceš, a platíš z nich, až když u tebe zákazník dá story. Odměnu spočítáme my. Žádný měsíční poplatek a nevyužité kredity ti zůstávají.</p>
          <p>Průběžné platby: připojíš kartu a platíš za každé story zvlášť, nic dopředu.</p>
          <p>Začni klidně v malém a uvidíš, co ti to přinese.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  "a.promo.add-budget.d7": {
    target: "ADVERTISER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL, PUSH],
    showCta: true,
    cadence: { kind: "advertiserAddBudgetNudge" as const, minDays: 7, maxDays: 14 },
    en: {
      push: {
        title: "📍 Locals find places through stories",
        body: () =>
          "A story from a real customer reaches people who can actually walk in.",
      },
      email: {
        subject: "What one story from a customer does",
        preheader: () => "Their followers live here. That's the point.",
        title: () => "Reach that can walk through the door",
        html: () => `
          <p>When a customer posts a story about your business, the people who see it mostly live nearby. That's the difference from ads: you're not paying to be seen by someone three time zones away.</p>
          <p>Every story comes from someone who was actually there, seen by locals who could be next.</p>
          <p>Add budget and it starts working, all by itself.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      push: {
        title: "📍 Lidé z okolí objevují podniky přes stories",
        body: () =>
          "Story od skutečného zákazníka uvidí lidé, kteří to k tobě mají kousek.",
      },
      email: {
        subject: "Co pro tebe udělá jedno story od zákazníka",
        preheader: () => "Jeho sledující bydlí kousek od tebe. A o to jde.",
        title: () => "Dosah, který k tobě dojde",
        html: () => `
          <p>Když zákazník dá story o tvém podniku, vidí ho hlavně lidé z okolí. V tom je rozdíl oproti reklamě: neplatíš za to, aby tě viděl někdo na druhém konci světa.</p>
          <p>Každé story je od někoho, kdo u tebe opravdu byl. A vidí ho lidé, kteří můžou přijít příště.</p>
          <p>Kup si kredity a začne to pracovat za tebe. Zbytek běží sám.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },

  // The add-budget goodbye — email only.
  "a.promo.add-budget.d21": {
    target: "ADVERTISER" as const,
    categorySlug: "promo",
    notificationType: "promo" as const,
    availableChannels: [EMAIL],
    showCta: true,
    cadence: {
      kind: "advertiserAddBudgetNudge" as const,
      minDays: 21,
      maxDays: 35,
    },
    en: {
      email: {
        subject: "Last email from us",
        preheader: () => "No deadline, nothing expires.",
        title: () => "This is the last one",
        html: () => `
          <p>This is the last email about getting your budget set up, promise. Your account stays exactly as it is, and there's no deadline.</p>
          <p>Whenever you're ready: add credits or turn on pay as you go, and your customers' stories start bringing in locals.</p>
          <p>The Tagly Team</p>
        `,
      },
    },
    cs: {
      email: {
        subject: "Poslední e-mail od nás",
        preheader: () => "Žádný termín, nic nepropadá.",
        title: () => "Od nás už máš klid",
        html: () => `
          <p>Tohle je poslední e-mail k rozjezdu, slibujeme. Tvůj účet zůstává, jak je, a žádný termín neběží.</p>
          <p>Až budeš chtít, kup kredity nebo zapni průběžné platby a zákazníci ti začnou dělat reklamu.</p>
          <p>Tým Tagly</p>
        `,
      },
    },
  },
} satisfies Record<string, LocalizedPromoEvent>;

export type PromoEventSlug = keyof typeof promoEventsRaw;
export type PcPromoEventSlug = Extract<PromoEventSlug, `pc.${string}`>;
export type CustomerPromoEventSlug = Extract<PromoEventSlug, `c.${string}`>;
export type AdvertiserPromoEventSlug = Extract<PromoEventSlug, `a.${string}`>;
