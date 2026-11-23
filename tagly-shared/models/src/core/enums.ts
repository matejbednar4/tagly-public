import { z } from "zod";

/** Media */
export const MediaTypeValues = ["IMAGE", "VIDEO"] as const;
export const MediaTypeSchema = z.enum(MediaTypeValues);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const OtpPurposeValues = [
  "REGISTRATION",
  "LOGIN",
  "EMAIL_CHANGE_CURRENT",
  "EMAIL_CHANGE_NEW",
  "PASSWORD_RESET",
  "ACCOUNT_DELETION",
] as const;
export const OtpPurposeSchema = z.enum(OtpPurposeValues);
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>;

export const PendingMediaPurposeValues = [
  "LOCAL_BANNER",
  "LOCAL_PHOTO",
] as const;
export const PendingMediaPurposeSchema = z.enum(PendingMediaPurposeValues);
export type PendingMediaPurpose = z.infer<typeof PendingMediaPurposeSchema>;

/** Accounts / Referrals */
export const AccountTypeValues = ["CUSTOMER", "ADVERTISER"] as const; // order matches schema
export const AccountTypeSchema = z.enum(AccountTypeValues);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const AccountReferralStatusValues = [
  "ACTIVE",
  "INACTIVE",
  "DELETED",
] as const;
export const AccountReferralStatusSchema = z.enum(AccountReferralStatusValues);
export type AccountReferralStatus = z.infer<typeof AccountReferralStatusSchema>;

export const ReferralTypeValues = ["SIGNUP", "SET_LATER"] as const;
export const ReferralTypeSchema = z.enum(ReferralTypeValues);
export type ReferralType = z.infer<typeof ReferralTypeSchema>;

/** Customer */
export const GenderValues = ["MALE", "FEMALE", "UNSPECIFIED"] as const;
export const GenderSchema = z.enum(GenderValues);
export type Gender = z.infer<typeof GenderSchema>;

export const CustomerStatusValues = ["ACTIVE", "BANNED"] as const;
export const CustomerStatusSchema = z.enum(CustomerStatusValues);
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;

/** Advertiser */
export const AdvertiserEntityValues = ["INDIVIDUAL", "ORGANIZATION"] as const;
export const AdvertiserEntitySchema = z.enum(AdvertiserEntityValues);
export type AdvertiserEntity = z.infer<typeof AdvertiserEntitySchema>;

/** Pending entities */
export const PendingEntityStatusValues = [
  "DRAFT",
  "PROCESSING",
  "FAILED",
  "READY",
] as const;
export const PendingEntityStatusSchema = z.enum(PendingEntityStatusValues);
export type PendingEntityStatus = z.infer<typeof PendingEntityStatusSchema>;

/** Subaccounts */
export const SubaccountStatusValues = ["ACTIVE", "DELETED", "BANNED"] as const;
export const SubaccountStatusSchema = z.enum(SubaccountStatusValues);
export type SubaccountStatus = z.infer<typeof SubaccountStatusSchema>;

/** Shares / IG */
export const IgPostTypeValues = ["STORY", "POST", "REEL"] as const;
export const IgPostTypeSchema = z.enum(IgPostTypeValues);
export type IgPostType = z.infer<typeof IgPostTypeSchema>;

/**
 * Share payout lifecycle (raw/internal). Collapsed in v2.0.0 from the old
 * insights/snapshot pipeline: a share is born PROCESSING and only a successful
 * payout (→ PAID) or a permanent payout failure (→ UNPAYABLE) moves it. Moderation
 * (rejection) lives on {@link ShareApprovalStatusValues} + the ShareReport row,
 * NOT here — a rejected share stays PROCESSING on this axis.
 */
export const ShareStatusValues = ["PROCESSING", "PAID", "UNPAYABLE"] as const;
export const ShareStatusSchema = z.enum(ShareStatusValues);
export type ShareStatus = z.infer<typeof ShareStatusSchema>;

/**
 * Customer-facing share status — DERIVED server-side from `status` +
 * `approvalStatus` + the ShareReport, never stored (see
 * `deriveCustomerShareStatus`). Precedence:
 * PAID > REJECTED (approvalStatus REJECTED || report VALID) > UNPAYABLE >
 * UNDER_REVIEW (approvalStatus PENDING) > REPORT_REVIEW (report PENDING) >
 * PROCESSING. UNPAYABLE outranks the holds: a share voided while still
 * PENDING approval is terminally failed and must read "failed", not "under
 * review". The v2 customer wire emits this; the raw {@link ShareStatusValues}
 * stays backend-internal.
 *
 * `UNDER_REVIEW` and `REPORT_REVIEW` are both "we're checking this" holds but sit
 * at different points in the lifecycle and are mutually exclusive on the raw axes:
 * `UNDER_REVIEW` is the *intake* gate (approvalStatus PENDING — before the share is
 * live), `REPORT_REVIEW` is a *post-approval* advertiser report awaiting admin
 * review (report PENDING — payout is held). Neither is a stored `status`; both are
 * derived (REPORT_REVIEW comes straight off `report.status`, never duplicated onto
 * the raw share status, which stays PROCESSING throughout).
 */
export const CustomerShareStatusValues = [
  "UNDER_REVIEW",
  "REPORT_REVIEW",
  "PROCESSING",
  "PAID",
  "UNPAYABLE",
  "REJECTED",
] as const;
export const CustomerShareStatusSchema = z.enum(CustomerShareStatusValues);
export type CustomerShareStatus = z.infer<typeof CustomerShareStatusSchema>;

/**
 * Advertiser-facing share status — DERIVED server-side from the raw
 * {@link ShareStatusValues} + the ShareReport, never stored (see
 * `deriveAdvertiserShareStatus`). The advertiser only ever sees APPROVED
 * shares (intake PENDING/REJECTED are invisible to them — see
 * {@link ShareApprovalStatusValues}), so there is no `UNDER_REVIEW` here.
 * Precedence: PAID > REJECTED (report VALID — the advertiser's report was
 * upheld, they won't be charged) > UNPAYABLE (payout failed/voided) >
 * REPORT_REVIEW (report PENDING — payout held while an admin reviews the
 * advertiser's report) > PROCESSING. The report's details stay on the
 * preview's `report` field; the status only collapses its lifecycle effect.
 */
export const AdvertiserShareStatusValues = [
  "PROCESSING",
  "REPORT_REVIEW",
  "PAID",
  "REJECTED",
  "UNPAYABLE",
] as const;
export const AdvertiserShareStatusSchema = z.enum(AdvertiserShareStatusValues);
export type AdvertiserShareStatus = z.infer<typeof AdvertiserShareStatusSchema>;

/**
 * Admin moderation gate, orthogonal to {@link ShareStatusValues} — the intake
 * decision, set once. New shares are PENDING (hidden from the advertiser, not
 * locked, not notified) until an admin APPROVES; REJECTED shares are never paid.
 * Rejection lives ONLY on this axis (status stays PROCESSING). A post-approval
 * report that is upheld is recorded on the ShareReport row (status VALID), not here.
 */
export const ShareApprovalStatusValues = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export const ShareApprovalStatusSchema = z.enum(ShareApprovalStatusValues);
export type ShareApprovalStatus = z.infer<typeof ShareApprovalStatusSchema>;

export const PurchaseStatusValues = ["WANTS_TO_PURCHASE", "PURCHASED"] as const;
export const PurchaseStatusSchema = z.enum(PurchaseStatusValues);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

export const AudienceLocationSourceValues = [
  "FOLLOWER_AUDIENCE",
  "REACHED_AUDIENCE",
] as const;
export const AudienceLocationSourceSchema = z.enum(
  AudienceLocationSourceValues,
);
export type AudienceLocationSource = z.infer<
  typeof AudienceLocationSourceSchema
>;

/** Reports (a share's quality rating itself is half-stars — see `core/rating.ts`) */

export const ReportTypeValues = [
  "NOT_PROMOTION",
  "MISLEADING_LOCATION",
  "INAPPROPRIATE",
  "DUPLICATE",
  "VIOLATES_GUIDELINES",
  "CUSTOMER_NOT_SPENT_MONEY",
] as const;
export const ReportTypeSchema = z.enum(ReportTypeValues);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportStatusValues = ["PENDING", "VALID", "DISMISSED"] as const;
export const ReportStatusSchema = z.enum(ReportStatusValues);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

/** Jobs */
export const JobStatusValues = [
  "SCHEDULED",
  "PROCESSING",
  "DONE",
  "FAILED",
] as const;
export const JobStatusSchema = z.enum(JobStatusValues);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/** Transactions */
export const TransactionKindValues = [
  "CREDIT_PURCHASE",
  "CREDIT_PURCHASE_REFUND",
  "CREDIT_PURCHASE_REFUND_LOCK",
  "CREDIT_PURCHASE_REFUND_UNLOCK",
  "WITHDRAWAL_LOCK",
  "WITHDRAWAL_UNLOCK",
  "WITHDRAWAL",
  "WITHDRAWAL_REVERSAL",
  "SHARE_LOCK",
  "SHARE_UNLOCK",
  "SHARE_PAYMENT",
  "PAYG_CHARGE",
  /** @deprecated No longer booked — kept only so historical rows stay readable. */
  "STRIPE_PROCESSING_FEE",
  "REFERRAL_PAYOUT",
  "PROMOTIONAL_CREDIT",
  "ADJUSTMENT",
] as const;
export const TransactionKindSchema = z.enum(TransactionKindValues);
export type TransactionKind = z.infer<typeof TransactionKindSchema>;

/** Kinds excluded from customer transaction picker (UI) */
export const CustomerPickerExcludedKinds: TransactionKind[] = [
  "CREDIT_PURCHASE",
  "CREDIT_PURCHASE_REFUND",
  "CREDIT_PURCHASE_REFUND_LOCK",
  "CREDIT_PURCHASE_REFUND_UNLOCK",
  "ADJUSTMENT",
  "PROMOTIONAL_CREDIT",
  "SHARE_LOCK",
  "SHARE_UNLOCK",
  "WITHDRAWAL_LOCK",
  "WITHDRAWAL_UNLOCK",
  "WITHDRAWAL_REVERSAL",
  "STRIPE_PROCESSING_FEE",
  // Advertiser-side card charge — not relevant to customers.
  "PAYG_CHARGE",
];

/** Kinds excluded from advertiser transaction picker (UI) */
export const AdvertiserPickerExcludedKinds: TransactionKind[] = [
  "WITHDRAWAL",
  "ADJUSTMENT",
  "PROMOTIONAL_CREDIT",
  "WITHDRAWAL_LOCK",
  "WITHDRAWAL_REVERSAL",
  "WITHDRAWAL_UNLOCK",
  "CREDIT_PURCHASE_REFUND",
  "CREDIT_PURCHASE_REFUND_LOCK",
  "CREDIT_PURCHASE_REFUND_UNLOCK",
  "STRIPE_PROCESSING_FEE",
];

/** Kinds the backend never returns to customers (API) */
export const CustomerBackendExcludedKinds: TransactionKind[] = [
  "WITHDRAWAL_LOCK",
  "WITHDRAWAL_UNLOCK",
];

/** Kinds the backend never returns to advertisers (API) */
export const AdvertiserBackendExcludedKinds: TransactionKind[] = [
  "STRIPE_PROCESSING_FEE",
  "CREDIT_PURCHASE_REFUND_LOCK",
  "CREDIT_PURCHASE_REFUND_UNLOCK",
];

/** Withdrawals */
export const WithdrawalStatusValues = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REVERSED",
] as const;
export const WithdrawalStatusSchema = z.enum(WithdrawalStatusValues);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatusSchema>;

/** Payout-leg state of a withdrawal (mirrors the DB enum; see withdrawals.md). */
export const WithdrawalPayoutStatusValues = [
  "NONE",
  "IN_FLIGHT",
  "PAID",
  "FAILED",
  "CANCELED",
] as const;
export const WithdrawalPayoutStatusSchema = z.enum(
  WithdrawalPayoutStatusValues,
);
export type WithdrawalPayoutStatus = z.infer<
  typeof WithdrawalPayoutStatusSchema
>;

/** Why the withdrawal exists (mirrors the DB enum). */
export const WithdrawalPurposeValues = [
  "CUSTOMER_WITHDRAWAL",
  "ACCOUNT_DELETION_SWEEP",
] as const;
export const WithdrawalPurposeSchema = z.enum(WithdrawalPurposeValues);
export type WithdrawalPurpose = z.infer<typeof WithdrawalPurposeSchema>;

/** OAuth sign-in providers (mirrors the DB enum). */
export const OAuthProviderValues = ["GOOGLE", "APPLE"] as const;
export const OAuthProviderSchema = z.enum(OAuthProviderValues);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

/**
 * Customer-facing withdrawal state, derived from the raw `WithdrawalStatus` (+
 * whether a payout failure was recorded). The raw status is overloaded — PENDING
 * spans "in flight", "money out, payout to bank pending", AND "payout to bank
 * failed" — so the client never renders it directly; the backend collapses it to
 * one of these via `deriveWithdrawalDisplayState`:
 *  - `PROCESSING` — money has left the Tagly balance, payout to the bank is in
 *    progress (raw PENDING, no payout failure recorded).
 *  - `DELAYED`    — Stripe couldn't pay it into the bank yet (raw PENDING + a
 *    recorded payout `failureCode`); the money left the balance but hasn't
 *    arrived. Usually fixable in the customer's payout details.
 *  - `PAID_OUT`   — the payout reached the bank (raw COMPLETED).
 *  - `FAILED`     — the transfer never went through, so nothing left the balance;
 *    it was returned in full (raw FAILED).
 *  - `REVERSED`   — the transfer was clawed back before payout; the amount was
 *    credited back to the Tagly balance (raw REVERSED).
 *
 * Note: the raw CANCELED status is never produced by the backend today, so it has
 * no display state — if one ever appears it maps to FAILED (nothing left).
 */
export const WithdrawalDisplayStateValues = [
  "PROCESSING",
  "DELAYED",
  "PAID_OUT",
  "FAILED",
  "REVERSED",
] as const;
export const WithdrawalDisplayStateSchema = z.enum(
  WithdrawalDisplayStateValues,
);
export type WithdrawalDisplayState = z.infer<
  typeof WithdrawalDisplayStateSchema
>;

/** CreditPurchases */
export const CreditPurchaseStatusValues = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export const CreditPurchaseStatusSchema = z.enum(CreditPurchaseStatusValues);
export type CreditPurchaseStatus = z.infer<typeof CreditPurchaseStatusSchema>;

export const CreditPurchaseKindValues = [
  "CREDIT_PURCHASE",
  "PAYG_CHARGE",
] as const;
export const CreditPurchaseKindSchema = z.enum(CreditPurchaseKindValues);
export type CreditPurchaseKind = z.infer<typeof CreditPurchaseKindSchema>;

/** Notifications */
export const NotificationChannelValues = ["IN_APP", "PUSH", "EMAIL"] as const;
export const NotificationChannelSchema = z.enum(NotificationChannelValues);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationEventStatusValues = ["ACTIVE", "INACTIVE"] as const;
export const NotificationEventStatusSchema = z.enum(
  NotificationEventStatusValues,
);
export type NotificationEventStatus = z.infer<
  typeof NotificationEventStatusSchema
>;

/** Admin */
export const AdminRoleValues = ["SUPER", "SUPPORT", "OPS"] as const;
export const AdminRoleSchema = z.enum(AdminRoleValues);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

/**
 * Pay-as-you-go — why an advertiser's PaygPeriod was closed.
 * `DISABLED` (PAYG turned off while keeping the saved card) was added with the
 * monthly-budget feature.
 */
export const PaygPeriodEndReasonValues = [
  "CARD_REMOVED",
  "CHARGE_FAILED",
  "DISABLED",
] as const;
export const PaygPeriodEndReasonSchema = z.enum(PaygPeriodEndReasonValues);
export type PaygPeriodEndReason = z.infer<typeof PaygPeriodEndReasonSchema>;

/** Monthly budget — why an advertiser's MonthlyBudgetPeriod was closed. */
export const MonthlyBudgetPeriodEndReasonValues = [
  "DISABLED",
  "TARGET_CHANGED",
  "CARD_REMOVED",
  "CHARGE_FAILED",
] as const;
export const MonthlyBudgetPeriodEndReasonSchema = z.enum(
  MonthlyBudgetPeriodEndReasonValues,
);
export type MonthlyBudgetPeriodEndReason = z.infer<
  typeof MonthlyBudgetPeriodEndReasonSchema
>;

/** How a share is funded at creation time (immutable per-share stamp). */
export const ShareFundingModeValues = [
  "CREDITS",
  "PAYG",
  "SUBSIDIZED",
] as const;
export const ShareFundingModeSchema = z.enum(ShareFundingModeValues);
export type ShareFundingMode = z.infer<typeof ShareFundingModeSchema>;

/**
 * Why a share was voided to UNPAYABLE — the user-facing classification stamped
 * by `markShareUnpayableAndUnlock` (the single UNPAYABLE writer). Clients map
 * each slug to localized copy on the share detail screens; the raw technical
 * detail stays server-side in `lastProcessingError` (admin-only). Null on
 * shares voided before the column existed → clients show generic fallback copy.
 */
export const ShareVoidReasonValues = [
  /** The customer disconnected their Instagram while the share was in flight. */
  "IG_DISCONNECTED",
  /** The customer's Instagram data was erased (Meta data-deletion / in-app request). */
  "IG_DATA_DELETED",
  /** The customer deleted their Tagly account. */
  "ACCOUNT_DELETED",
  /** The story's stats couldn't be collected before it expired — usually the
   *  story was deleted early or the Instagram link broke. */
  "INSIGHTS_UNAVAILABLE",
  /** The reward settlement failed permanently. */
  "SETTLEMENT_FAILED",
] as const;
export const ShareVoidReasonSchema = z.enum(ShareVoidReasonValues);
export type ShareVoidReason = z.infer<typeof ShareVoidReasonSchema>;
