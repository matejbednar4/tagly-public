import { z } from "zod";
import {
  AdvertiserUidSchema,
  CreditPurchaseUidSchema,
} from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema } from "../../../../core/money";
import {
  AdvertiserEntitySchema,
  CreditPurchaseKindSchema,
  CreditPurchaseStatusSchema,
  MonthlyBudgetPeriodEndReasonSchema,
  PaygPeriodEndReasonSchema,
} from "../../../../core/enums";
import { MonthlyBudgetStatusSchema } from "../../advertiserApp/billing/monthlyBudgetStatus";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../core/locale";
import { AdminLedgerEventSchema } from "../shares/adminLedgerEvent";
import { AdminBusinessSchema } from "../businesses/adminBusiness";
import { AdminReferralSchema } from "../common/adminReferral";
import { PushTokenSummarySchema } from "../common/pushTokenSummary";
import { AdminNotificationPrefSchema } from "../common/adminNotificationPref";
import { AdminAuthIdentitySchema } from "../common/adminAuthIdentity";

export const AdminCreditPurchaseSchema = z.object({
  uid: CreditPurchaseUidSchema,
  /** CREDIT_PURCHASE (refundable top-up) vs PAYG_CHARGE (non-refundable). */
  kind: CreditPurchaseKindSchema,
  amountCents: CentsSchema,
  status: CreditPurchaseStatusSchema,
  stripeCheckoutSessionId: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  stripeChargeId: z.string().nullable(),
  ledgerEvents: z.array(AdminLedgerEventSchema),
  createdAt: ISODateSchema,
});
export type AdminCreditPurchaseInput = z.input<typeof AdminCreditPurchaseSchema>;

export const AdminAdvertiserShareStatisticsSchema = z.object({
  totalShares: z.number(),
  totalSpendCents: z.number(),
  averagePricePerShareCents: z.number(),
  uniqueCustomers: z.number(),
  totalReach: z.number(),
});

/**
 * One advertiser, full admin view. Clean v2, expanded (§B.5) with PAYG detail,
 * notification reach, account-level visibility (`isVisible` — the roll-up of
 * per-business accessibility), agreements, and Stripe customer id — on top of
 * the budget / businesses / stats / referral / credit-purchase blocks. `businesses`
 * embeds the full `AdminBusiness` for each owned page.
 */
export const AdminAdvertiserSchema = z.object({
  uid: AdvertiserUidSchema,
  email: z.string(),
  entity: AdvertiserEntitySchema.nullable(),
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
  agreedToTermsOfServiceAt: ISODateSchema,
  agreedToPrivacyPolicyAt: ISODateSchema,
  /** Account-level visibility roll-up: at least one business is accessible. */
  isVisible: z.boolean(),

  promoNotificationsEnabled: z.boolean(),
  pushTokens: PushTokenSummarySchema,
  /** Per-event effective push/email state (catalog order). */
  notificationPrefs: z.array(AdminNotificationPrefSchema),
  /** Linked OAuth identities; empty = signs in by email code. */
  authIdentities: z.array(AdminAuthIdentitySchema),

  availableBudgetUsdCents: CentsSchema,
  lockedBudgetUsdCents: CentsSchema,
  /**
   * Lifetime GROSS credits purchased, derived from the ledger (sum of
   * CREDIT_PURCHASE events only — PAYG charges, refunds, dispute clawbacks and
   * deletion forfeits are excluded), so it is not a net figure and the admin UI
   * must not present it as "money we kept". Display only; nothing gates on it.
   */
  totalCreditPurchasesUsdCents: CentsSchema,
  stripeCustomerId: z.string().nullable(),

  /** The account's ONE saved off-session card (shared by PAYG + monthly budget). */
  savedCard: z.object({
    onFile: z.boolean(),
    /** When the advertiser last consented to off-session charges. */
    offSessionChargeAuthorizedAt: ISODateSchema.nullable(),
  }),
  payg: z.object({
    hasActivePaygPeriod: z.boolean(),
    /** Why the latest period closed (null = never closed / never opened). */
    lastEndedReason: PaygPeriodEndReasonSchema.nullable(),
  }),
  monthlyBudget: z.object({
    status: MonthlyBudgetStatusSchema,
    active: z.boolean(),
    /** The monthly target; null unless active. */
    targetCents: CentsSchema.nullable(),
    /** Next top-up (or retry); null unless active. */
    nextRunAt: ISODateSchema.nullable(),
    /** When the current period was opened (a re-target opens a new one). */
    startedAt: ISODateSchema.nullable(),
    /** Declines spent on the current month's charge (0 = none / done). */
    chargeAttempts: z.number().int(),
    lastFailureCode: z.string().nullable(),
    lastEndedReason: MonthlyBudgetPeriodEndReasonSchema.nullable(),
  }),

  businesses: z.array(AdminBusinessSchema),
  shareStatistics: AdminAdvertiserShareStatisticsSchema,
  referral: AdminReferralSchema,
  creditPurchases: z.array(AdminCreditPurchaseSchema),
});
export type AdminAdvertiser = z.infer<typeof AdminAdvertiserSchema>;
export type AdminAdvertiserInput = z.input<typeof AdminAdvertiserSchema>;
