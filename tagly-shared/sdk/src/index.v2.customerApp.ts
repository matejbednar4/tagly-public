// v2 customerApp SDK entry point — `@tagly/sdk/v2/customerApp`.
// Clean v2 client functions for customer-only endpoints, mirroring backend
// `controllers/v2/customerApp`. `initSdk`/config still come from
// `@tagly/sdk/shared` (version-agnostic).
//
// `auth/` is split by intent — `register/` (the ordered onboarding flow,
// numbered by step) and `login/` (standalone login). `checkRegistration` sits
// at the `auth/` root: it's a launch-time resume resolver, not a register step.

// Auth — register (onboarding flow, in step order)
export * from "./endpoints/v2/customerApp/auth/register/1.0startEmail";
export * from "./endpoints/v2/customerApp/auth/register/1.1resendOtp";
export * from "./endpoints/v2/customerApp/auth/register/1.2verifyOtp";
export * from "./endpoints/v2/customerApp/auth/register/1.3googleSignIn";
export * from "./endpoints/v2/customerApp/auth/register/1.4appleSignIn";
export * from "./endpoints/v2/customerApp/auth/register/2.0saveMarketingConsent";
export * from "./endpoints/v2/customerApp/auth/register/2.1registerPendingPushToken";
export * from "./endpoints/v2/customerApp/auth/register/2.2attachReferrer";
export * from "./endpoints/v2/customerApp/auth/register/3.saveProfile";
export * from "./endpoints/v2/customerApp/auth/register/4.completeRegistration";

// Auth — launch-time resume resolver (not a register step)
export * from "./endpoints/v2/customerApp/auth/checkRegistration";

// Auth — login
export * from "./endpoints/v2/customerApp/auth/login/instagramLogin";

// Customers — lean core profile (more slices added as endpoints land).
export * from "./endpoints/v2/customerApp/me/getMe";
export * from "./endpoints/v2/customerApp/me/update/updateLocale";
export * from "./endpoints/v2/customerApp/me/update/updateLanguage";
export * from "./endpoints/v2/customerApp/me/update/updateName";
export * from "./endpoints/v2/customerApp/me/update/updateGender";
export * from "./endpoints/v2/customerApp/me/update/updateEstimatedStoryViews";
export * from "./endpoints/v2/customerApp/me/update/updateInterests";
export * from "./endpoints/v2/customerApp/me/update/updateReferralCode";
export * from "./endpoints/v2/customerApp/me/update/updateReferrerCode";
export * from "./endpoints/v2/customerApp/me/update/updateMarketingConsent";
export * from "./endpoints/v2/customerApp/me/security/signOutOtherSessions";
export * from "./endpoints/v2/customerApp/me/email/startChangeEmail";
export * from "./endpoints/v2/customerApp/me/email/verifyChangeEmail";
export * from "./endpoints/v2/customerApp/me/delete-account/startDeleteAccount";
export * from "./endpoints/v2/customerApp/me/delete-account/confirmDeleteAccount";
export * from "./endpoints/v2/customerApp/me/notifications/listNotificationSettings";
export * from "./endpoints/v2/customerApp/me/notifications/updateNotificationPreferences";

// Customers — app-open flow (side-effects + IG probe + share-opportunity stub)
export * from "./endpoints/v2/customerApp/me/onAppOpen";
export * from "./endpoints/v2/customerApp/me/instagram/refreshInstagram";
export * from "./endpoints/v2/customerApp/me/instagram/snapshotStatus";
export * from "./endpoints/v2/customerApp/me/instagram/connectInstagram";
export * from "./endpoints/v2/customerApp/me/instagram/disconnectInstagram";
export * from "./endpoints/v2/customerApp/me/instagram/getStories";
export * from "./endpoints/v2/customerApp/me/shareOpportunity";

// Customers — cached sub-resources (statistics + referrals)
export * from "./endpoints/v2/customerApp/me/statistics";
export * from "./endpoints/v2/customerApp/me/referrals";

// Customers — own shares (create from a live story + paginated list + detail)
export * from "./endpoints/v2/customerApp/shares/createShare";
export * from "./endpoints/v2/customerApp/shares/shares";
export * from "./endpoints/v2/customerApp/shares/getShareByUid";

// Customers — money history (earnings + withdrawals)
export * from "./endpoints/v2/customerApp/transactions/getTransactions";

// Customers — cash out (Stripe Connect onboarding + withdrawals)
export * from "./endpoints/v2/customerApp/billing/stripe/startConnectOnboarding";
export * from "./endpoints/v2/customerApp/billing/stripe/getConnectStatus";
export * from "./endpoints/v2/customerApp/billing/stripe/createExpressDashboardLink";
export * from "./endpoints/v2/customerApp/billing/stripe/createWithdrawal";
export * from "./endpoints/v2/customerApp/billing/stripe/getWithdrawalStatus";

// Businesses (locals) — map region fetch + search + Discover shelves.
export * from "./endpoints/v2/customerApp/businesses/getBusinessesInRegion";
export * from "./endpoints/v2/customerApp/businesses/getBusinessesFromSearch";
export * from "./endpoints/v2/customerApp/businesses/getRecommendedBusinesses";
export * from "./endpoints/v2/customerApp/businesses/getMostPayingBusinesses";
export * from "./endpoints/v2/customerApp/businesses/getNearestBusinesses";
export * from "./endpoints/v2/customerApp/businesses/getAllBusinesses";
export * from "./endpoints/v2/customerApp/businesses/getVisitedBusinesses";
export * from "./endpoints/v2/customerApp/businesses/getBusinessByUid";
