/**
 * Shared types for notification catalogs.
 * Both transactionalCatalog.ts and promoCatalog.ts import from here
 * to avoid circular dependencies.
 */
import {
  AccountType,
  NotificationChannel,
} from "../../../generated/prisma/client.js";

export type PushTemplate = {
  /** Static string or function for dynamic titles (e.g. including a business name or content type). */
  title: string | ((payload: any) => string);
  body: (payload: any) => string;
  /**
   * Extra data sent in the push notification payload alongside `slug`.
   * Receives the full job payload and returns only what the client needs.
   *
   * Common fields:
   * - `screen` — named destination key the client app resolves to an actual route.
   *   Customer keys: "map", "shares", "share-details", "balance", "withdrawals", "cash-out"
   *   Advertiser keys: "shares", "share-details", "credits"
   * - `uid` — required when `screen` is a dynamic route (e.g. "share-details").
   *   The client builds the full path from the uid.
   *
   * Omit the field entirely to open the default/home screen.
   */
  data?: (payload: any) => Record<string, string | null | undefined>;
};
export type EmailTemplate = {
  subject: string | ((payload: any) => string);
  html: (payload: any) => string;
  preheader?: (payload: any) => string | undefined;
  title?: (payload: any) => string | undefined;
};

export type BaseEvent = {
  target: AccountType; // 'CUSTOMER' | 'ADVERTISER' | 'PENDING_CUSTOMER'
  categorySlug: string;
  availableChannels: ReadonlyArray<NotificationChannel>;
  mandatoryChannels?: ReadonlyArray<NotificationChannel>;
  sortOrder?: number;
  /**
   * Controls email chrome + gates: "promo" adds the unsubscribe link and is
   * consent-gated; "transactional" adds a "manage in app" note; "admin" uses
   * the bulk sender with NO unsubscribe and bypasses every opt-out gate
   * (audience filtering happens at queue time in the v2 blast controller).
   */
  notificationType: "promo" | "transactional" | "admin";
  /** Promo-only: defines the eligibility window used by the maintenance scheduling worker. */
  cadence?: PromoCadence;
  /**
   * Email-only: when true, the email ends with the standard CTA button that
   * opens the recipient's app (the ONLY thing an email CTA may do — resolved
   * from the slug audience prefix, `a.` → advertiser app, else customer app;
   * see `sendEmailNotification`). Set it when the email's natural next step is
   * in the app (money moved, action needed); leave unset for security, legal,
   * and ban mail, where the action is reply/read/nothing. Don't ALSO embed a
   * `renderEmailButton` in the template `html()` — one button per email.
   */
  showCta?: boolean;
  push?: PushTemplate; // not stored in db - runtime only
  email?: EmailTemplate; // not stored in db - runtime only
  inAppTitle?: string; // not stored in db - runtime only
};

/** Transactional events appear in in-app notification settings, so they need a label and description. */
export type TransactionalEvent = BaseEvent & {
  notificationType: "transactional";
  label: string;
  description: string;
};

/** Promo events are scheduling-driven and have no in-app settings — no label or description needed. */
export type PromoEvent = BaseEvent & { notificationType: "promo"; cadence: PromoCadence };

/** Admin blast events are one-off sends initiated from the admin app. Content comes from the job payload. */
export type AdminEvent = BaseEvent & { notificationType: "admin" };

/**
 * Cadence for promo events — drives eligibility windows in the scheduling helpers.
 * Each kind maps to a different scheduling helper and query pattern.
 *
 * pendingCustomerNudge     — measured from PendingCustomer.createdAt
 * firstShareNudge          — measured from Customer.createdAt, only for customers with 0 shares
 * inactivityReminder       — measured from most recent Share.createdAt
 * advertiserAddBudgetNudge — measured from Advertiser.createdAt, only for never-funded advertisers
 *
 * There is no pendingAdvertiserNudge: consent is the last advertiser onboarding
 * step before promotion, so a consented PendingAdvertiserAccount never survives
 * long enough for a cadence window to match (see promoCatalog.ts).
 */
export type PromoCadence =
  | { kind: "pendingCustomerNudge"; minHours: number; maxHours: number }
  | { kind: "firstShareNudge"; minDays: number; maxDays: number }
  | { kind: "inactivityReminder"; minDays: number; maxDays: number }
  | { kind: "advertiserAddBudgetNudge"; minDays: number; maxDays: number };
