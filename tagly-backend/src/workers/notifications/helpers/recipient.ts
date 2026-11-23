import type { AccountType } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";
import { normalizeLanguage } from "../../../utils/localization/localizeCatalog.js";
import { resolvePromoTimezone } from "../../../utils/queue/promoSendTime.js";
import { hasAdvertiserEverPurchasedCredits } from "../../../utils/money/ledger/advertiserCreditPurchases.js";
import type { SupportedLanguage } from "@tagly/models/shared";

/**
 * Per-recipient lookups by `(target, id)` — the one place that knows how to reach
 * or read a recipient across all four account types (customer, advertiser, and
 * both pendings). `executeNotificationJob` composes these; keeping the target
 * branching here (not inline in the orchestrator) is the whole point.
 */

/**
 * Resolve the email address for a recipient. Returns null if not found, for an
 * unsupported target, or — for the two PENDING targets — when the address was
 * never OTP-verified: an unverified pending row can hold a mistyped address its
 * owner never proved, and no queued mail may ever go there. Defense in depth —
 * the queue writers already exclude unverified pendings (the blast controller's
 * verified-email filter, the pending-nudge scheduler's `emailVerified: true`
 * eligibility), so a null here for that reason means a queue writer missed the
 * rule and the job's 8006 permanent failure is the alarm.
 */
export async function resolveEmail(
  target: AccountType,
  id: number,
): Promise<string | null> {
  if (target === "ADVERTISER") {
    const a = await prisma.advertiser.findUnique({
      where: { id },
      select: { email: true },
    });
    return a?.email ?? null;
  }
  if (target === "CUSTOMER") {
    const c = await prisma.customer.findUnique({
      where: { id },
      select: { email: true },
    });
    return c?.email ?? null;
  }
  if (target === "PENDING_CUSTOMER") {
    const pc = await prisma.pendingCustomer.findUnique({
      where: { id },
      select: { email: true, emailVerified: true },
    });
    return pc?.emailVerified ? pc.email : null;
  }
  if (target === "PENDING_ADVERTISER") {
    const pa = await prisma.pendingAdvertiserAccount.findUnique({
      where: { id },
      select: { email: true, emailVerified: true },
    });
    return pa?.emailVerified ? pa.email : null;
  }
  return null;
}

/** Resolve active push tokens, newest first. */
export async function resolvePushTokens(
  target: AccountType,
  id: number,
): Promise<string[]> {
  if (target === "CUSTOMER") {
    const rows = await prisma.pushToken.findMany({
      where: { customerId: id, disabledAt: null },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  if (target === "ADVERTISER") {
    const rows = await prisma.pushToken.findMany({
      where: { advertiserId: id, disabledAt: null },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  if (target === "PENDING_CUSTOMER") {
    const row = await prisma.pushToken.findFirst({
      where: { pendingCustomerId: id, disabledAt: null },
      select: { token: true },
    });
    return row ? [row.token] : [];
  }

  if (target === "PENDING_ADVERTISER") {
    const row = await prisma.pushToken.findFirst({
      where: { pendingAdvertiserId: id, disabledAt: null },
      select: { token: true },
    });
    return row ? [row.token] : [];
  }

  return [];
}

/**
 * Resolve the recipient's preferred language, normalized to a SupportedLanguage
 * (defaults to "en" when unknown/unsupported). The senders pick the localized
 * (en/cs) template from the catalog with this.
 */
export async function resolveRecipientLanguage(
  target: AccountType,
  id: number,
): Promise<SupportedLanguage> {
  if (target === "CUSTOMER") {
    const c = await prisma.customer.findUnique({
      where: { id },
      select: { language: true },
    });
    return normalizeLanguage(c?.language);
  }
  if (target === "ADVERTISER") {
    const a = await prisma.advertiser.findUnique({
      where: { id },
      select: { language: true },
    });
    return normalizeLanguage(a?.language);
  }
  if (target === "PENDING_CUSTOMER") {
    const pc = await prisma.pendingCustomer.findUnique({
      where: { id },
      select: { language: true },
    });
    return normalizeLanguage(pc?.language);
  }
  if (target === "PENDING_ADVERTISER") {
    const pa = await prisma.pendingAdvertiserAccount.findUnique({
      where: { id },
      select: { language: true },
    });
    return normalizeLanguage(pa?.language);
  }
  return "en";
}

/**
 * When the recipient was last active in the app, from the freshest
 * `PushToken.lastSeenAt` across ALL their tokens (disabled included — a
 * disabled token's stamp still proves a past app open). Stamped by
 * `upsertPushToken` on every on-app-open for logged-in users, and by the
 * check-registration resume resolvers (customer + advertiser) on every app
 * launch for pending users — so both populations have a reliable "returned
 * since" signal for the waterfall's escalation skip. A pending user who
 * actually finished loses their row and the trailing email is skipped by the
 * `mayReceivePromo` existence gate.
 */
export async function getRecipientLastSeenAt(
  target: AccountType,
  id: number,
): Promise<Date | null> {
  const owner =
    target === "CUSTOMER"
      ? { customerId: id }
      : target === "ADVERTISER"
        ? { advertiserId: id }
        : target === "PENDING_CUSTOMER"
          ? { pendingCustomerId: id }
          : target === "PENDING_ADVERTISER"
            ? { pendingAdvertiserId: id }
            : null;
  if (!owner) return null;

  const row = await prisma.pushToken.findFirst({
    where: { ...owner, lastSeenAt: { not: null } },
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });
  return row?.lastSeenAt ?? null;
}

/**
 * The recipient's IANA timezone for promo quiet-hours placement, resolved at
 * SEND time with the same ladder the queue-time scheduler uses
 * (`resolvePromoTimezone`): freshest active token's device-reported zone →
 * locale market default → fallback. Used by the send-time quiet-hours re-snap
 * (a job can drift past its window via backlog/retries) and by the email leg's
 * sibling deferral.
 */
export async function getPromoSendTimezone(
  target: AccountType,
  id: number,
): Promise<string> {
  const owner =
    target === "CUSTOMER"
      ? { customerId: id }
      : target === "ADVERTISER"
        ? { advertiserId: id }
        : target === "PENDING_CUSTOMER"
          ? { pendingCustomerId: id }
          : target === "PENDING_ADVERTISER"
            ? { pendingAdvertiserId: id }
            : null;

  const token = owner
    ? await prisma.pushToken.findFirst({
        where: { ...owner, disabledAt: null },
        orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
        select: { timezone: true },
      })
    : null;

  let locale: string | null = null;
  if (target === "CUSTOMER") {
    locale =
      (
        await prisma.customer.findUnique({
          where: { id },
          select: { locale: true },
        })
      )?.locale ?? null;
  } else if (target === "PENDING_CUSTOMER") {
    locale =
      (
        await prisma.pendingCustomer.findUnique({
          where: { id },
          select: { locale: true },
        })
      )?.locale ?? null;
  } else if (target === "ADVERTISER") {
    locale =
      (
        await prisma.advertiser.findUnique({
          where: { id },
          select: { locale: true },
        })
      )?.locale ?? null;
  } else if (target === "PENDING_ADVERTISER") {
    locale =
      (
        await prisma.pendingAdvertiserAccount.findUnique({
          where: { id },
          select: { locale: true },
        })
      )?.locale ?? null;
  }

  return resolvePromoTimezone(token?.timezone, locale);
}

/**
 * Whether the recipient may still receive promo / marketing sends — the send-time
 * re-check for opt-out after queueing. True only if the recipient exists AND
 * their consent flag is an explicit `true`.
 *
 * The strict `=== true` matters for the two PENDING targets: their
 * `promoNotificationsEnabled` is nullable and stays null until the user answers
 * the consent step, and null means "never consented" — NOT consent (E056; Apple
 * 4.5.4 / v2.0.0.md consent policy: explicit opt-in, default off). For
 * Customer/Advertiser the column is non-nullable, so `=== true` is equivalent
 * to the old "not opted out" check. Mirrors the schedulers' eligibility
 * queries and `queuePromoNotificationJobsOrReturn`'s `optedOut`.
 */
export async function mayReceivePromo(
  target: AccountType,
  id: number,
): Promise<boolean> {
  const record =
    target === "CUSTOMER"
      ? await prisma.customer.findUnique({
          where: { id },
          select: { promoNotificationsEnabled: true },
        })
      : target === "PENDING_CUSTOMER"
        ? await prisma.pendingCustomer.findUnique({
            where: { id },
            select: { promoNotificationsEnabled: true },
          })
        : target === "ADVERTISER"
          ? await prisma.advertiser.findUnique({
              where: { id },
              select: { promoNotificationsEnabled: true },
            })
          : target === "PENDING_ADVERTISER"
            ? await prisma.pendingAdvertiserAccount.findUnique({
                where: { id },
                select: { promoNotificationsEnabled: true },
              })
            : null;

  return record?.promoNotificationsEnabled === true;
}

/**
 * The sticky "funded" fact for the add-budget promo gate — the `getMe` formula
 * (open PAYG period, any positive available/locked balance, any credit purchase
 * ever) PLUS a PAYG card on file (decided: a card counts as funded even before
 * its first open period — never nag someone who just added a card). Used by the
 * send-time re-check so an advertiser who funds between queue and send is never
 * asked to fund again; the scheduler applies the same conditions set-based.
 */
export async function isAdvertiserFunded(id: number): Promise<boolean> {
  const a = await prisma.advertiser.findUnique({
    where: { id },
    select: {
      sensitiveData: {
        select: {
          availableBudgetUsdCents: true,
          lockedBudgetUsdCents: true,
          savedPaymentMethodId: true,
        },
      },
      paygPeriods: { where: { endedAt: null }, select: { id: true }, take: 1 },
    },
  });
  if (!a) return false;
  if (
    a.paygPeriods.length > 0 ||
    a.sensitiveData.savedPaymentMethodId !== null ||
    a.sensitiveData.availableBudgetUsdCents > 0n ||
    a.sensitiveData.lockedBudgetUsdCents > 0n
  ) {
    return true;
  }
  // Cheapest leg last: an indexed EXISTS on the ledger, only reached for
  // accounts with nothing on the balance columns.
  return hasAdvertiserEverPurchasedCredits(id);
}
