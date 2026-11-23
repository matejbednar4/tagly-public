// v2 adminApp entry point — `@tagly/models/v2/adminApp`.
// Clean v2 contracts for admin-only endpoints, mirroring backend
// `controllers/v2/adminApp`. Versioned: deleted wholesale at the next cutover.
// Shared building blocks (enums, UIDs, Email) remain in `core/`
// (`@tagly/models/shared`).
//
// Admin auth is a distinct login flow (no OAuth): email(`@flaer.app`) + password
// + a long emailed code → an admin-capability bearer JWT. See v2.0.0.md §3B.

// Auth
export * from "./endpoints/v2/adminApp/auth/login";
export * from "./endpoints/v2/adminApp/auth/verifyOtp";
export * from "./endpoints/v2/adminApp/auth/me";
export * from "./endpoints/v2/adminApp/auth/logout";

// Reads
export * from "./endpoints/v2/adminApp/statistics/getStatistics";
export * from "./endpoints/v2/adminApp/balance/getStripeBalance";
export * from "./endpoints/v2/adminApp/entities/listEntities";
export * from "./endpoints/v2/adminApp/search/search";
export * from "./endpoints/v2/adminApp/customers/getCustomerByUid";
export * from "./endpoints/v2/adminApp/advertisers/getAdvertiserByUid";
export * from "./endpoints/v2/adminApp/businesses/getBusinessByUid";
export * from "./endpoints/v2/adminApp/shares/getShareByUid";
export * from "./endpoints/v2/adminApp/shares/getSharesFromUid";
export * from "./endpoints/v2/adminApp/ledger/getLedgerEventsFromUid";

// Review (moderation queues + actions)
export * from "./endpoints/v2/adminApp/review/getReviewCounts";
export * from "./endpoints/v2/adminApp/shares/getSharesPendingApproval";
export * from "./endpoints/v2/adminApp/shares/getSharesPendingReport";
export * from "./endpoints/v2/adminApp/shares/getUnratedShares";
export * from "./endpoints/v2/adminApp/shares/approveShare";
export * from "./endpoints/v2/adminApp/shares/rejectShare";
export * from "./endpoints/v2/adminApp/shares/reviewShareReport";
export * from "./endpoints/v2/adminApp/shares/assessShare";
export * from "./endpoints/v2/adminApp/links/getPendingLinks";
export * from "./endpoints/v2/adminApp/links/reviewLink";

// Billing actions
export * from "./endpoints/v2/adminApp/advertisers/assignPromotionalCredit";
export * from "./endpoints/v2/adminApp/advertisers/setAdvertiserReferrer";
export * from "./endpoints/v2/adminApp/creditPurchases/refundCreditPurchase";

// Businesses (create + edit — wire-twins of the advertiser endpoints, same
// `utils/businesses/*Core` behind both; see each schema file)
export * from "./endpoints/v2/adminApp/businesses/createBusinessInit";
export * from "./endpoints/v2/adminApp/businesses/createBusinessConfirm";
export * from "./endpoints/v2/adminApp/businesses/updateBusiness";
export * from "./endpoints/v2/adminApp/businesses/updateBusinessMediaInit";
export * from "./endpoints/v2/adminApp/businesses/updateBusinessMediaConfirm";

// Business actions (subsidize / ban / onboarding-assist advertiser handover)
export * from "./endpoints/v2/adminApp/businesses/setBusinessSubsidized";
export * from "./endpoints/v2/adminApp/businesses/setBusinessBanned";
export * from "./endpoints/v2/adminApp/businesses/setBusinessAdvertiser";

// Customer actions (ban / rating-multiplier set)
export * from "./endpoints/v2/adminApp/customers/setCustomerBanned";
export * from "./endpoints/v2/adminApp/customers/setCustomerMultiplier";

// Notifications (admin blast — one-off operational/promo announcements)
export * from "./endpoints/v2/adminApp/notifications/sendBlast";
export * from "./endpoints/v2/adminApp/notifications/getBlasts";
export * from "./endpoints/v2/adminApp/notifications/getSenderDomains";

// DTOs — common
export * from "./dtos/v2/adminApp/common/adminReferral";
export * from "./dtos/v2/adminApp/common/pushTokenSummary";
export * from "./dtos/v2/adminApp/common/adminNotificationPref";
export * from "./dtos/v2/adminApp/common/adminAuthIdentity";
// DTOs — shares
export * from "./dtos/v2/adminApp/shares/adminLedgerEvent";
export * from "./dtos/v2/adminApp/shares/adminFinalPrice";
export * from "./dtos/v2/adminApp/shares/adminShareReport";
export * from "./dtos/v2/adminApp/shares/adminShare";
// DTOs — businesses
export * from "./dtos/v2/adminApp/businesses/businessAccessibility";
export * from "./dtos/v2/adminApp/businesses/adminBusiness";
// DTOs — customers / advertisers
export * from "./dtos/v2/adminApp/customers/adminCustomer";
export * from "./dtos/v2/adminApp/advertisers/adminAdvertiser";
// DTOs — links
export * from "./dtos/v2/adminApp/links/adminPendingLink";

// QR stickers — printed sticker → business mapping (assign / unassign / list)
export * from "./endpoints/v2/adminApp/stickers/assignQrSticker";
export * from "./endpoints/v2/adminApp/stickers/unassignQrSticker";
export * from "./endpoints/v2/adminApp/stickers/getBusinessQrStickers";
export * from "./dtos/v2/adminApp/stickers/adminQrSticker";
// DTOs — notifications (blast)
export * from "./dtos/v2/adminApp/notifications/adminBlast";
