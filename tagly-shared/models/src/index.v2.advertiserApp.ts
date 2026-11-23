// v2 advertiserApp entry point — `@tagly/models/v2/advertiserApp`.
// Clean v2 contracts for advertiser-only endpoints, mirroring backend
// `controllers/v2/advertiserApp`. Versioned: deleted wholesale at the next
// cutover. Shared building blocks (enums, UIDs, SupportedLocale, ApiError)
// remain in `core/` (`@tagly/models/shared`).
//
// `auth/register/` is the ordered onboarding flow (numbered by step). It mirrors
// the customer flow except: no profile step on the pending account (the account
// is created first, business setup follows), and no Instagram login.

// Auth — register (onboarding flow, in step order)
export * from "./endpoints/v2/advertiserApp/auth/register/1.0startEmail";
export * from "./endpoints/v2/advertiserApp/auth/register/1.1resendOtp";
export * from "./endpoints/v2/advertiserApp/auth/register/1.2verifyOtp";
export * from "./endpoints/v2/advertiserApp/auth/register/1.3googleSignIn";
export * from "./endpoints/v2/advertiserApp/auth/register/1.4appleSignIn";
export * from "./endpoints/v2/advertiserApp/auth/register/2.0saveMarketingConsent";
export * from "./endpoints/v2/advertiserApp/auth/register/2.1registerPendingPushToken";
export * from "./endpoints/v2/advertiserApp/auth/register/2.2attachReferrer";
export * from "./endpoints/v2/advertiserApp/auth/register/3.finishRegistration";

// Auth — launch-time resume resolver (not a register step)
export * from "./endpoints/v2/advertiserApp/auth/checkRegistration";

// Me — the logged-in advertiser's own profile
export * from "./dtos/v2/advertiserApp/me/advertiserMe";
export * from "./dtos/v2/advertiserApp/me/advertiserStatistics";
export * from "./dtos/v2/advertiserApp/me/advertiserReferrals";
export * from "./endpoints/v2/advertiserApp/me/getMe";
export * from "./endpoints/v2/advertiserApp/me/statistics";
export * from "./endpoints/v2/advertiserApp/me/getReferrals";
export * from "./endpoints/v2/advertiserApp/me/onAppOpen";

// Me — account management (settings surfaces). The notification-settings DTO is
// shared with the customer app, so it lives in crossApp and is re-exported here.
export * from "./dtos/v2/crossApp/me/notifications/notificationSettings";
export * from "./endpoints/v2/advertiserApp/me/email/startChangeEmail";
export * from "./endpoints/v2/advertiserApp/me/email/verifyChangeEmail";
export * from "./endpoints/v2/advertiserApp/me/security/signOutOtherSessions";
export * from "./endpoints/v2/advertiserApp/me/delete-account/startDeleteAccount";
export * from "./endpoints/v2/advertiserApp/me/delete-account/confirmDeleteAccount";
export * from "./endpoints/v2/advertiserApp/me/update/updateLanguage";
export * from "./endpoints/v2/advertiserApp/me/update/updateReferralCode";
export * from "./endpoints/v2/advertiserApp/me/update/updateReferrerCode";
export * from "./endpoints/v2/advertiserApp/me/update/updateMarketingConsent";
export * from "./endpoints/v2/advertiserApp/me/notifications/listNotifications";
export * from "./endpoints/v2/advertiserApp/me/notifications/updateNotificationPreferences";

// Shares — the advertiser's shares (list, unrated strip, detail, rate/report)
export * from "./dtos/v2/advertiserApp/shares/shareReportOwner";
export * from "./dtos/v2/advertiserApp/shares/advertiserSharePreview";
export * from "./dtos/v2/advertiserApp/shares/advertiserShareDetails";
export * from "./endpoints/v2/advertiserApp/shares/getShares";
export * from "./endpoints/v2/advertiserApp/shares/getUnratedShares";
export * from "./endpoints/v2/advertiserApp/shares/getShareByUid";
export * from "./endpoints/v2/advertiserApp/shares/submitAssessment";

// Billing — PaymentSheet surface (PAYG card-link + prepaid credit top-ups)
export * from "./dtos/v2/advertiserApp/billing/paygStatus";
export * from "./endpoints/v2/advertiserApp/billing/payg/setupPaygCard";
export * from "./endpoints/v2/advertiserApp/billing/payg/reconcilePaygCard";
export * from "./endpoints/v2/advertiserApp/billing/payg/getPaygState";
export * from "./endpoints/v2/advertiserApp/billing/payg/removePaygCard";
export * from "./endpoints/v2/advertiserApp/billing/payg/disablePayg";
export * from "./endpoints/v2/advertiserApp/billing/payg/enablePayg";
// Billing — the account's ONE saved off-session card (shared by PAYG + monthly budget)
export * from "./dtos/v2/advertiserApp/billing/savedCard";
export * from "./endpoints/v2/advertiserApp/billing/paymentMethod/setupSavedCard";
export * from "./endpoints/v2/advertiserApp/billing/paymentMethod/reconcileSavedCard";
export * from "./endpoints/v2/advertiserApp/billing/paymentMethod/getSavedCard";
export * from "./endpoints/v2/advertiserApp/billing/paymentMethod/removeSavedCard";
// Billing — monthly budget (recurring top-up to a target on the 1st)
export * from "./dtos/v2/advertiserApp/billing/monthlyBudgetStatus";
export * from "./endpoints/v2/advertiserApp/billing/monthlyBudget/getMonthlyBudget";
export * from "./endpoints/v2/advertiserApp/billing/monthlyBudget/setMonthlyBudget";
export * from "./endpoints/v2/advertiserApp/billing/monthlyBudget/disableMonthlyBudget";
export * from "./endpoints/v2/advertiserApp/billing/createCreditPurchase";
export * from "./endpoints/v2/advertiserApp/billing/settleNegativeBalance";
export * from "./endpoints/v2/advertiserApp/billing/getCreditPurchaseStatus";

// Transactions — the advertiser's unified money history feed
export * from "./dtos/v2/advertiserApp/billing/advertiserTransaction";
export * from "./endpoints/v2/advertiserApp/billing/getTransactions";

// Businesses — the advertiser's own business pages (local subaccounts)
export * from "./dtos/v2/advertiserApp/businesses/businessOwnerPreview";
export * from "./dtos/v2/advertiserApp/businesses/businessOwnerDetails";
export * from "./endpoints/v2/advertiserApp/businesses/getBusinesses";
export * from "./endpoints/v2/advertiserApp/businesses/getBusinessByUid";
export * from "./endpoints/v2/advertiserApp/businesses/createBusinessInit";
export * from "./endpoints/v2/advertiserApp/businesses/createBusinessConfirm";
export * from "./endpoints/v2/advertiserApp/businesses/updateBusiness";
export * from "./endpoints/v2/advertiserApp/businesses/updateBusinessMediaInit";
export * from "./endpoints/v2/advertiserApp/businesses/updateBusinessMediaConfirm";
export * from "./endpoints/v2/advertiserApp/businesses/deleteBusiness";
