/**
 * Notification registry — single source of truth for all event slugs and templates.
 *
 * Merges three sources:
 *   - shared notification events catalog (transactional metadata: target,
 *     categorySlug, label, description, channels, sortOrder) + backend
 *     transactionalTemplates (push/email rendering).
 *   - promoCatalog: scheduling-driven marketing events, NOT stored in the DB.
 *     Backend-only because they have no FE settings and reference
 *     PENDING_CUSTOMER (which isn't in the shared AccountType enum).
 *   - adminCatalog: one-off blast events (`POST /v2/admin/notifications/blast`).
 *     Backend-only — content comes from the job payload, no FE display.
 *
 * Import slug types and the runtime lookup map from here.
 */

import type {
  BaseEvent,
  TransactionalEvent,
  PushTemplate,
  EmailTemplate,
} from "./notificationTypes.js";
import { transactionalTemplates } from "./transactionalCatalog.js";
import { promoEventsRaw, type PromoEventSlug } from "./promoCatalog.js";
import { adminEventsRaw, type AdminEventSlug } from "./adminCatalog.js";
import {
  AccountType,
  NotificationChannel,
} from "../../../generated/prisma/client.js";
import {
  notificationEvents as sharedNotificationEvents,
  type NotificationEventSlug,
  type SupportedLanguage,
} from "@tagly/models/shared";

// Compose backend transactional events from shared metadata + backend templates.
// We cast to a literal-keyed Record so that `keyof typeof allEventsRaw` below
// gives a literal slug union (string would collapse downstream Extract patterns).
//
// `BaseEvent.push` / `BaseEvent.email` are the English variants for back-compat
// with the existing send pipeline. Once the senders thread a `lang` parameter
// through, they should call `pickTransactionalTemplate(slug, lang)` instead.
const transactionalEventsRaw = Object.fromEntries(
  sharedNotificationEvents.map((meta) => {
    const tpl = transactionalTemplates[
      meta.slug as keyof typeof transactionalTemplates
    ] as
      | {
          showCta?: boolean;
          en: { push?: PushTemplate; email?: EmailTemplate };
          cs: { push?: PushTemplate; email?: EmailTemplate };
        }
      | undefined;
    return [
      meta.slug,
      {
        target: meta.target as AccountType,
        categorySlug: meta.categorySlug,
        notificationType: "transactional" as const,
        // English back-compat — runtime code consuming `label` / `description`
        // should be migrated to the shared catalog. Mobile clients still read
        // these via the DB-seeded fields.
        label: meta.label.en,
        description: meta.description.en,
        availableChannels: meta.availableChannels as NotificationChannel[],
        mandatoryChannels: meta.mandatoryChannels as
          | NotificationChannel[]
          | undefined,
        sortOrder: meta.sortOrder,
        showCta: tpl?.showCta,
        push: tpl?.en.push,
        email: tpl?.en.email,
      },
    ];
  }),
) as unknown as Record<NotificationEventSlug, TransactionalEvent>;

/**
 * Returns the push/email templates for a transactional slug in the recipient's
 * language. Use this from the send pipeline once recipient language resolution
 * is wired in. Falls back to English if the requested language isn't defined.
 */
export function pickTransactionalTemplate(
  slug: NotificationEventSlug,
  lang: SupportedLanguage,
): { push?: PushTemplate; email?: EmailTemplate } {
  const tpl = transactionalTemplates[slug];
  return tpl[lang] ?? tpl.en;
}

/**
 * Returns the push/email templates for a promo slug in the recipient's
 * language. Mirror of pickTransactionalTemplate for the promo catalog.
 */
export function pickPromoTemplate(
  slug: PromoEventSlug,
  lang: SupportedLanguage,
): { push?: PushTemplate; email?: EmailTemplate } {
  const tpl = promoEventsRaw[slug];
  return tpl[lang] ?? tpl.en;
}

/**
 * Returns the push/email templates for an admin blast slug in the recipient's
 * language. The variants render per-language CONTENT from the job payload
 * (`{ push: { en, cs? }, email: { en, cs? } }`), with the `cs` variants
 * falling back to the EN content when no CS copy was provided.
 */
export function pickAdminTemplate(
  slug: AdminEventSlug,
  lang: SupportedLanguage,
): { push?: PushTemplate; email?: EmailTemplate } {
  const tpl = adminEventsRaw[slug];
  return tpl[lang] ?? tpl.en;
}

/**
 * Resolves push/email templates for any event slug in the recipient's
 * language, dispatching to the right localized catalog.
 *
 * This is the single entry point the send pipeline should use.
 */
export function pickEventTemplate(
  slug: AnyEventSlug,
  lang: SupportedLanguage,
): { push?: PushTemplate; email?: EmailTemplate } {
  if (slug in transactionalTemplates) {
    return pickTransactionalTemplate(slug as NotificationEventSlug, lang);
  }
  if (slug in promoEventsRaw) {
    return pickPromoTemplate(slug as PromoEventSlug, lang);
  }
  if (slug in adminEventsRaw) {
    return pickAdminTemplate(slug as AdminEventSlug, lang);
  }
  const e = notificationEvents[slug];
  return { push: e?.push, email: e?.email };
}

// Promo entries carry templates under `en` / `cs`. The existing send pipeline
// reads `push` / `email` directly off BaseEvent, so we hoist the English
// variant up here for back-compat. Senders should switch to pickPromoTemplate
// once language resolution is wired through.
type PromoEntry = (typeof promoEventsRaw)[PromoEventSlug];
const promoEventsAsBase = Object.fromEntries(
  (Object.entries(promoEventsRaw) as [PromoEventSlug, PromoEntry][]).map(
    ([slug, e]) => {
      const en = e.en as { push?: PushTemplate; email?: EmailTemplate };
      return [
        slug,
        {
          target: e.target,
          categorySlug: e.categorySlug,
          notificationType: e.notificationType,
          availableChannels: e.availableChannels,
          cadence: e.cadence,
          // Promo entries may opt into the standard open-the-app email CTA
          // the same way transactional templates do (not inferred on the raw
          // literal type until one sets it, hence the cast).
          showCta: (e as { showCta?: boolean }).showCta,
          push: en.push,
          email: en.email,
        },
      ];
    },
  ),
) as unknown as Record<PromoEventSlug, BaseEvent>;

// Admin entries carry `en`/`cs` variants like promo; hoist the English one so
// BaseEvent consumers (notificationType/target/channel checks) keep working.
type AdminEntry = (typeof adminEventsRaw)[AdminEventSlug];
const adminEventsAsBase = Object.fromEntries(
  (Object.entries(adminEventsRaw) as [AdminEventSlug, AdminEntry][]).map(
    ([slug, e]) => [
      slug,
      {
        target: e.target,
        categorySlug: e.categorySlug,
        notificationType: e.notificationType,
        availableChannels: e.availableChannels,
        push: e.en.push,
        email: e.en.email,
      },
    ],
  ),
) as unknown as Record<AdminEventSlug, BaseEvent>;

const allEventsRaw = {
  ...transactionalEventsRaw,
  ...promoEventsAsBase,
  ...adminEventsAsBase,
} satisfies Record<string, BaseEvent>;

// --- Slug types ---

export type AnyEventSlug = keyof typeof allEventsRaw;
export type CustomerEventSlug = Extract<AnyEventSlug, `c.${string}`>;
export type AdvertiserEventSlug = Extract<AnyEventSlug, `a.${string}`>;
export type PcPromoEventSlug = Extract<AnyEventSlug, `pc.${string}`>;

// --- Runtime lookup map ---

export const notificationEvents: Record<AnyEventSlug, BaseEvent> = allEventsRaw;

// --- Slug arrays ---

export const allEventSlugs = Object.keys(notificationEvents) as AnyEventSlug[];

export const customerEventSlugs = allEventSlugs.filter(
  (s): s is CustomerEventSlug => s.startsWith("c."),
);

export const advertiserEventSlugs = allEventSlugs.filter(
  (s): s is AdvertiserEventSlug => s.startsWith("a."),
);

export type CustomerEventSlugFromArray = (typeof customerEventSlugs)[number];
export type AdvertiserEventSlugFromArray =
  (typeof advertiserEventSlugs)[number];

// --- Push template map ---

export const pushTemplates: Record<AnyEventSlug, PushTemplate | undefined> =
  Object.fromEntries(
    allEventSlugs.map((slug) => [slug, notificationEvents[slug].push]),
  ) as Record<AnyEventSlug, PushTemplate | undefined>;

// --- Seed arrays (split by type) ---

export type EventPersistDef = {
  slug: AnyEventSlug;
  label: string;
  description: string;
  target: AccountType;
  categorySlug: string;
  availableChannels: NotificationChannel[];
  mandatoryChannels?: NotificationChannel[];
  sortOrder?: number;
};

function buildEventsForSeed(
  raw: Record<string, TransactionalEvent>,
): EventPersistDef[] {
  return Object.entries(raw).map(([slug, e]) => ({
    slug: slug as AnyEventSlug,
    label: e.label,
    description: e.description,
    target: e.target,
    categorySlug: e.categorySlug,
    availableChannels: Array.from(e.availableChannels),
    mandatoryChannels: e.mandatoryChannels
      ? Array.from(e.mandatoryChannels)
      : undefined,
    sortOrder: e.sortOrder,
  }));
}

/**
 * Transactional events as a flat array for seeding into NotificationEvent.
 * These are user-configurable and must have a matching NotificationCategory row.
 */
export const transactionalEventsForSeed: EventPersistDef[] = buildEventsForSeed(
  transactionalEventsRaw,
);
