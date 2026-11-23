// v2 adminApp SDK entry point — `@tagly/sdk/v2/adminApp`.
// Client functions for the admin app's v2 endpoints. Admin login is
// email(`@flaer.app`) + password + a long emailed code → bearer JWT (see
// v2.0.0.md §3B). Mirrors backend `controllers/v2/adminApp`.

// Auth
export * from "./endpoints/v2/adminApp/auth/adminLogin";
export * from "./endpoints/v2/adminApp/auth/adminVerifyOtp";
export * from "./endpoints/v2/adminApp/auth/adminGetMe";
export * from "./endpoints/v2/adminApp/auth/adminLogout";

// Reads
export * from "./endpoints/v2/adminApp/statistics/adminGetStatistics";
export * from "./endpoints/v2/adminApp/balance/adminGetStripeBalance";
export * from "./endpoints/v2/adminApp/entities/adminListEntities";
export * from "./endpoints/v2/adminApp/search/adminSearch";
export * from "./endpoints/v2/adminApp/customers/adminGetCustomerByUid";
export * from "./endpoints/v2/adminApp/advertisers/adminGetAdvertiserByUid";
export * from "./endpoints/v2/adminApp/businesses/adminGetBusinessByUid";
export * from "./endpoints/v2/adminApp/shares/adminGetShareByUid";
export * from "./endpoints/v2/adminApp/shares/adminGetSharesFromUid";
export * from "./endpoints/v2/adminApp/ledger/adminGetLedgerEventsFromUid";

// Review (moderation queues + actions)
export * from "./endpoints/v2/adminApp/review/adminGetReviewCounts";
export * from "./endpoints/v2/adminApp/shares/adminGetSharesPendingApproval";
export * from "./endpoints/v2/adminApp/shares/adminGetSharesPendingReport";
export * from "./endpoints/v2/adminApp/shares/adminGetUnratedShares";
export * from "./endpoints/v2/adminApp/shares/adminApproveShare";
export * from "./endpoints/v2/adminApp/shares/adminRejectShare";
export * from "./endpoints/v2/adminApp/shares/adminReviewShareReport";
export * from "./endpoints/v2/adminApp/shares/adminAssessShare";
export * from "./endpoints/v2/adminApp/links/adminGetPendingLinks";
export * from "./endpoints/v2/adminApp/links/adminReviewLink";

// Billing actions
export * from "./endpoints/v2/adminApp/advertisers/adminAssignPromotionalCredit";
export * from "./endpoints/v2/adminApp/creditPurchases/adminRefundCreditPurchase";

// Referrals (sales-assisted attribution fix)
export * from "./endpoints/v2/adminApp/advertisers/adminSetAdvertiserReferrer";

// Businesses (create + edit)
export * from "./endpoints/v2/adminApp/businesses/adminCreateBusinessInit";
export * from "./endpoints/v2/adminApp/businesses/adminCreateBusinessConfirm";
export * from "./endpoints/v2/adminApp/businesses/adminUpdateBusiness";
export * from "./endpoints/v2/adminApp/businesses/adminUpdateBusinessMediaInit";
export * from "./endpoints/v2/adminApp/businesses/adminUpdateBusinessMediaConfirm";

// Business actions (subsidize / ban / onboarding-assist advertiser handover)
export * from "./endpoints/v2/adminApp/businesses/adminSetBusinessSubsidized";
export * from "./endpoints/v2/adminApp/businesses/adminSetBusinessBanned";
export * from "./endpoints/v2/adminApp/businesses/adminSetBusinessAdvertiser";

// QR stickers (printed sticker → business mapping)
export * from "./endpoints/v2/adminApp/stickers/adminAssignQrSticker";
export * from "./endpoints/v2/adminApp/stickers/adminUnassignQrSticker";
export * from "./endpoints/v2/adminApp/stickers/adminGetBusinessQrStickers";

// Customer actions (ban / rating-multiplier set)
export * from "./endpoints/v2/adminApp/customers/adminSetCustomerBanned";
export * from "./endpoints/v2/adminApp/customers/adminSetCustomerMultiplier";

// Notifications (admin blast)
export * from "./endpoints/v2/adminApp/notifications/adminSendBlast";
export * from "./endpoints/v2/adminApp/notifications/adminGetBlasts";
export * from "./endpoints/v2/adminApp/notifications/adminGetBlastSenderDomains";
