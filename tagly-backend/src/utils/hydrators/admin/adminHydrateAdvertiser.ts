import prisma from "../../../prisma/prisma.js";
import { adminGetNotificationPrefs } from "./adminGetNotificationPrefs.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import adminHydrateLocal from "./adminHydrateLocal.js";
import adminHydrateLedgerEvents from "./adminHydrateLedgerEvents.js";
import {
  isAdvertiserVisible,
  hasActiveAdvertiserPaygPeriod,
} from "../../businesses/businessAccessibility.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { sharePaidSql } from "../../shares/shareAccess.js";
import { asBigInt } from "../../formatting/asBigInt.js";
import { ADMIN_APPROVED_SHARE_STATUS } from "../../shares/shareAccess.js";
import type {
  AdminAdvertiserInput,
  AdminCreditPurchaseInput,
} from "@tagly/models/v2/adminApp";
import type { SupportedLocale, SupportedLanguage } from "@tagly/models/shared";
import { sumAdvertiserCreditPurchasesCents } from "../../money/ledger/advertiserCreditPurchases.js";
import { deriveMonthlyBudgetStatus } from "../billing/deriveMonthlyBudgetStatus.js";

export default async function adminHydrateAdvertiser({
  advertiserId,
}: {
  advertiserId: number;
}): Promise<AdminAdvertiserInput> {
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      uid: true,
      email: true,
      entity: true,
      locale: true,
      language: true,
      promoNotificationsEnabled: true,
      createdAt: true,
      updatedAt: true,
      agreedToTermsOfServiceAt: true,
      agreedToPrivacyPolicyAt: true,
      pushTokens: { select: { platform: true, disabledAt: true } },
      // Latest period of each card-charging feature: open = on; closed = its
      // endedReason is the "why it stopped".
      paygPeriods: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { endedAt: true, endedReason: true },
      },
      monthlyBudgetPeriods: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          endedAt: true,
          endedReason: true,
          targetCents: true,
          nextRunAt: true,
          startedAt: true,
          chargeAttempts: true,
          lastFailureCode: true,
        },
      },
      oauthIdentities: {
        select: { provider: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      sensitiveData: {
        select: {
          availableBudgetUsdCents: true,
          lockedBudgetUsdCents: true,
          stripeCustomerId: true,
          savedPaymentMethodId: true,
          offSessionChargeAuthorizedAt: true,
        },
      },
      accountReferral: {
        select: {
          id: true,
          code: true,
          status: true,
          referredEvent: {
            select: {
              referrerCode: {
                select: {
                  code: true,
                  customer: { select: { uid: true } },
                  advertiser: { select: { uid: true } },
                },
              },
              createdAt: true,
              adminReason: true,
              setByAdmin: { select: { uid: true, username: true } },
            },
          },
        },
      },
      locals: { select: { id: true } },
      stripeCreditPurchases: {
        select: {
          uid: true,
          kind: true,
          amountCents: true,
          status: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
          stripeChargeId: true,
          ledgerEvents: { select: { id: true }, orderBy: { createdAt: "asc" } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!advertiser) {
    throw createCustomError(4043, "Advertiser not found", 404);
  }

  const localIds = advertiser.locals.map((l) => l.id);
  const [hydratedLocals, isVisible, hasActivePaygPeriod] = await Promise.all([
    localIds.length > 0 ? adminHydrateLocal({ localIds }) : Promise.resolve([]),
    isAdvertiserVisible(advertiserId),
    hasActiveAdvertiserPaygPeriod(advertiserId),
  ]);

  // Aggregate share statistics over APPROVED shares only (advertiser-visible).
  const statsRow = await db
    .selectFrom("app.shares as s")
    .leftJoin("app.final_price as fp", "fp.share_id", "s.id")
    .leftJoin("app.share_insights as si", "si.share_id", "s.id")
    .select(() => [
      sql<number>`CAST(COUNT(*) AS INT)`.as("total_shares"),
      sql<number>`CAST(COUNT(DISTINCT s.customer_id) AS INT)`.as(
        "unique_customers",
      ),
      sql<number>`COALESCE(SUM(COALESCE(si.reach,0)),0)::int`.as("total_reach"),
      sql<number>`CAST(COUNT(*) FILTER (WHERE ${sharePaidSql("s")}) AS INT)`.as(
        "paid_count",
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents), 0)::text`.as(
        "total_spend_cents",
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents) FILTER (WHERE ${sharePaidSql("s")}), 0)::text`.as(
        "paid_sum_cents",
      ),
    ])
    .where("s.advertiser_id", "=", advertiserId)
    .where("s.approval_status", "=", ADMIN_APPROVED_SHARE_STATUS)
    .executeTakeFirst();

  const paidCount = statsRow?.paid_count ?? 0;
  const totalSpendCents = Number(asBigInt(statsRow?.total_spend_cents ?? "0"));
  const paidSumCents = asBigInt(statsRow?.paid_sum_cents ?? "0");
  const averagePricePerShareCents =
    paidCount > 0 ? Number(paidSumCents / BigInt(paidCount)) : 0;

  // Credit purchases with ledger events
  const allLedgerEventIds = advertiser.stripeCreditPurchases.flatMap((cp) =>
    cp.ledgerEvents.map((e) => e.id),
  );
  const hydratedLedgerEvents =
    allLedgerEventIds.length > 0
      ? await adminHydrateLedgerEvents({ ledgerEventIds: allLedgerEventIds })
      : [];
  const ledgerEventById = new Map(
    allLedgerEventIds.map((id, i) => [id, hydratedLedgerEvents[i]]),
  );

  const creditPurchases: AdminCreditPurchaseInput[] =
    advertiser.stripeCreditPurchases.map((cp) => ({
      uid: cp.uid,
      kind: cp.kind,
      amountCents: cp.amountCents,
      status: cp.status,
      stripeCheckoutSessionId: cp.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: cp.stripePaymentIntentId ?? null,
      stripeChargeId: cp.stripeChargeId ?? null,
      ledgerEvents: cp.ledgerEvents.map((e) => ledgerEventById.get(e.id)!),
      createdAt: cp.createdAt,
    }));

  // Referral counts + ledger-derived lifetime credit purchases
  const referralId = advertiser.accountReferral.id;
  const [referredUsersCount, referredBusinessesCount, totalCreditPurchasesUsdCents] =
    await Promise.all([
      prisma.customer.count({
        where: { accountReferral: { referredEvent: { referrerCodeId: referralId } } },
      }),
      prisma.advertiser.count({
        where: { accountReferral: { referredEvent: { referrerCodeId: referralId } } },
      }),
      sumAdvertiserCreditPurchasesCents(advertiserId),
    ]);

  const referredByEvent = advertiser.accountReferral.referredEvent;
  const referralPayload = {
    code: advertiser.accountReferral.code,
    status: advertiser.accountReferral.status,
    referredUsersCount,
    referredBusinessesCount,
    referredBy: referredByEvent
      ? {
          code: referredByEvent.referrerCode.code,
          at: referredByEvent.createdAt,
          referrerUid:
            referredByEvent.referrerCode.customer?.uid ??
            referredByEvent.referrerCode.advertiser!.uid,
          referrerType: (referredByEvent.referrerCode.customer
            ? "customer"
            : "advertiser") as "customer" | "advertiser",
          setByAdmin: referredByEvent.setByAdmin
            ? {
                uid: referredByEvent.setByAdmin.uid,
                username: referredByEvent.setByAdmin.username,
                reason: referredByEvent.adminReason,
              }
            : null,
        }
      : null,
  };

  const activeTokens = advertiser.pushTokens.filter((t) => t.disabledAt == null);
  const pushTokens = {
    activeCount: activeTokens.length,
    platforms: Array.from(
      new Set(
        activeTokens
          .map((t) => t.platform)
          .filter((p): p is string => p != null),
      ),
    ),
  };

  // Per-event effective push/email state (§B.5).
  const notificationPrefs = await adminGetNotificationPrefs({
    target: "ADVERTISER",
    accountId: advertiserId,
  });

  return {
    uid: advertiser.uid,
    email: advertiser.email,
    entity: advertiser.entity,
    // Writer-guaranteed supported; read as-is.
    locale: advertiser.locale as SupportedLocale,
    language: advertiser.language as SupportedLanguage,
    createdAt: advertiser.createdAt,
    updatedAt: advertiser.updatedAt,
    agreedToTermsOfServiceAt: advertiser.agreedToTermsOfServiceAt,
    agreedToPrivacyPolicyAt: advertiser.agreedToPrivacyPolicyAt,
    isVisible,
    promoNotificationsEnabled: advertiser.promoNotificationsEnabled,
    pushTokens,
    notificationPrefs,
    authIdentities: advertiser.oauthIdentities.map((i) => ({
      provider: i.provider,
      email: i.email,
      linkedAt: i.createdAt,
    })),
    availableBudgetUsdCents: advertiser.sensitiveData.availableBudgetUsdCents,
    lockedBudgetUsdCents: advertiser.sensitiveData.lockedBudgetUsdCents,
    totalCreditPurchasesUsdCents,
    stripeCustomerId: advertiser.sensitiveData.stripeCustomerId,
    savedCard: {
      onFile: advertiser.sensitiveData.savedPaymentMethodId != null,
      offSessionChargeAuthorizedAt:
        advertiser.sensitiveData.offSessionChargeAuthorizedAt,
    },
    payg: {
      hasActivePaygPeriod,
      lastEndedReason: advertiser.paygPeriods[0]?.endedReason ?? null,
    },
    monthlyBudget: (() => {
      const latest = advertiser.monthlyBudgetPeriods[0] ?? null;
      const active = latest != null && latest.endedAt === null;
      return {
        status: deriveMonthlyBudgetStatus({
          cardOnFile: advertiser.sensitiveData.savedPaymentMethodId != null,
          periodOpen: active,
          lastEndedReason: latest?.endedReason ?? null,
        }),
        active,
        targetCents: active ? latest.targetCents : null,
        nextRunAt: active ? latest.nextRunAt : null,
        startedAt: latest?.startedAt ?? null,
        chargeAttempts: latest?.chargeAttempts ?? 0,
        lastFailureCode: latest?.lastFailureCode ?? null,
        lastEndedReason: latest?.endedReason ?? null,
      };
    })(),
    businesses: hydratedLocals,
    shareStatistics: {
      totalShares: statsRow?.total_shares ?? 0,
      totalSpendCents,
      averagePricePerShareCents,
      uniqueCustomers: statsRow?.unique_customers ?? 0,
      totalReach: statsRow?.total_reach ?? 0,
    },
    referral: referralPayload,
    creditPurchases,
  };
}
