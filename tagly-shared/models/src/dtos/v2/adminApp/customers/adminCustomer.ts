import { z } from "zod";
import { CustomerUidSchema, WithdrawalUidSchema } from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { CentsSchema, CurrencyCodeSchema } from "../../../../core/money";
import {
  GenderSchema,
  WithdrawalStatusSchema,
  WithdrawalPayoutStatusSchema,
  WithdrawalPurposeSchema,
  AudienceLocationSourceSchema,
  CustomerStatusSchema,
} from "../../../../core/enums";
import {
  SupportedLocaleSchema,
  SupportedLanguageSchema,
} from "../../../../core/locale";
import { AdminLedgerEventSchema } from "../shares/adminLedgerEvent";
import { AdminReferralSchema } from "../common/adminReferral";
import { PushTokenSummarySchema } from "../common/pushTokenSummary";
import { AdminNotificationPrefSchema } from "../common/adminNotificationPref";
import { AdminAuthIdentitySchema } from "../common/adminAuthIdentity";

export const AdminCustomerSensitiveDataSchema = z.object({
  balanceUsdCents: CentsSchema,
  lockedBalanceUsdCents: CentsSchema,
  multiplierBps: z.number(),
  stripeConnectId: z.string().nullable(),
  payoutsEnabledAt: ISODateSchema.nullable(),
});

export const AdminCustomerWithdrawalSchema = z.object({
  uid: WithdrawalUidSchema,
  amountCents: CentsSchema,
  currency: CurrencyCodeSchema,
  status: WithdrawalStatusSchema,
  /** Payout-leg state (ledger `status` is the money summary; see withdrawals.md). */
  payoutStatus: WithdrawalPayoutStatusSchema,
  /** Customer-initiated withdrawal vs the account-deletion balance sweep. */
  purpose: WithdrawalPurposeSchema,
  instant: z.boolean(),
  stripeTransferId: z.string().nullable(),
  stripePayoutId: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  ledgerEvents: z.array(AdminLedgerEventSchema),
  createdAt: ISODateSchema,
});
export type AdminCustomerWithdrawalInput = z.input<
  typeof AdminCustomerWithdrawalSchema
>;

export const AdminCustomerInstagramSnapshotSchema = z.object({
  followerCount: z.number(),
  audienceLocationsSource: AudienceLocationSourceSchema.nullable(),
  audienceLocationsTotalValue: z.number(),
  audienceGenderAgeTotalValue: z.number(),
  snapshotTakenAt: ISODateSchema,
  audienceLocations: z.array(
    z.object({
      address: z.string(),
      value: z.number(),
      source: AudienceLocationSourceSchema,
    }),
  ),
  audienceGenderAges: z.array(
    z.object({ gender: z.string(), age: z.string(), value: z.number() }),
  ),
});

export const AdminCustomerInstagramSchema = z.object({
  instagramUid: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  pfpUrl: z.string().nullable(),
  followerCount: z.number(),
  accountType: z.string(),
  connectedAt: ISODateSchema,
  latestSnapshot: AdminCustomerInstagramSnapshotSchema.nullable(),
});

export const AdminCustomerShareStatisticsSchema = z.object({
  totalShares: z.number(),
  paidShares: z.number(),
  totalRewardsCents: CentsSchema,
  averageRewardPerShareCents: CentsSchema,
  totalReferralPayoutsCents: CentsSchema,
  visitedPlaces: z.number(),
});

/**
 * One customer, full admin view. Clean v2, expanded with the "everything useful"
 * fields (§B.5): `status` + `banReason`, notification reach
 * (`promoNotificationsEnabled` + `pushTokens`), `interests`, and account
 * timestamps — on top of the money/instagram/referral/withdrawal blocks.
 */
export const AdminCustomerSchema = z.object({
  uid: CustomerUidSchema,
  fullName: z.string(),
  email: z.string(),
  status: CustomerStatusSchema,
  /** Ban reason from the BannedInstagram row — only when status is BANNED, else null. */
  banReason: z.string().nullable(),
  gender: GenderSchema,
  locale: SupportedLocaleSchema,
  language: SupportedLanguageSchema,
  interests: z.array(z.string()),
  promoNotificationsEnabled: z.boolean(),
  pushTokens: PushTokenSummarySchema,
  /** Per-event effective push/email state (catalog order). */
  notificationPrefs: z.array(AdminNotificationPrefSchema),
  /** Linked OAuth identities; empty = signs in by email code only. */
  authIdentities: z.array(AdminAuthIdentitySchema),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
  agreedToTermsOfServiceAt: ISODateSchema,
  agreedToPrivacyPolicyAt: ISODateSchema,

  sensitiveData: AdminCustomerSensitiveDataSchema,
  instagram: AdminCustomerInstagramSchema.nullable(),
  shareStatistics: AdminCustomerShareStatisticsSchema,
  referral: AdminReferralSchema,
  withdrawals: z.array(AdminCustomerWithdrawalSchema),
});
export type AdminCustomer = z.infer<typeof AdminCustomerSchema>;
export type AdminCustomerInput = z.input<typeof AdminCustomerSchema>;
