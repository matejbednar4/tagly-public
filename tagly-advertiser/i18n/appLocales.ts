/**
 * Advertiser-app colocated i18n registry.
 *
 * The shared `@tagly/client` singleton bundles the central + shared-package
 * namespaces (including `localePicker`, which now lives in `tagly-shared/client`). This
 * file registers the advertiser app's **colocated** namespaces — those whose
 * `*.en.json`/`*.cs.json` live next to their screen (route folder) or composed
 * sub-view (under `components/onboarding/`).
 *
 * To add a colocated namespace:
 *   1. Put `MyScreen.en.json` + `MyScreen.cs.json` next to the component/route.
 *   2. Import both here and `registerLocale("myNs", { en, cs })`.
 *   3. Add `myNs: typeof myNsEn` to the `TaglyI18nResources` augmentation below
 *      so `t()` stays type-checked.
 *
 * Imported for its side effects at app boot (see `app/_layout.tsx`).
 */
import { registerLocale } from "@tagly/client";

import onboardingEn from "@/components/onboarding/Welcome/Welcome.en.json";
import onboardingCs from "@/components/onboarding/Welcome/Welcome.cs.json";
import signInEn from "@/components/onboarding/SignIn/SignIn.en.json";
import signInCs from "@/components/onboarding/SignIn/SignIn.cs.json";
import onboardingContextEn from "@/contexts/onboarding/OnboardingContext.en.json";
import onboardingContextCs from "@/contexts/onboarding/OnboardingContext.cs.json";
import otpEn from "@/app/(onboarding)/otp/otp.en.json";
import otpCs from "@/app/(onboarding)/otp/otp.cs.json";
import notificationsEn from "@/app/(onboarding)/notifications/notifications.en.json";
import notificationsCs from "@/app/(onboarding)/notifications/notifications.cs.json";
import consentEn from "@/app/(onboarding)/consent/consent.en.json";
import consentCs from "@/app/(onboarding)/consent/consent.cs.json";
import finishingEn from "@/app/(onboarding)/finishing/finishing.en.json";
import finishingCs from "@/app/(onboarding)/finishing/finishing.cs.json";
import tabsEn from "@/app/(app)/(tabs)/tabs.en.json";
import tabsCs from "@/app/(app)/(tabs)/tabs.cs.json";
import homeEn from "@/app/(app)/(tabs)/home/home.en.json";
import homeCs from "@/app/(app)/(tabs)/home/home.cs.json";
import walletEn from "@/app/(app)/(tabs)/wallet/wallet.en.json";
import walletCs from "@/app/(app)/(tabs)/wallet/wallet.cs.json";
import accountEn from "@/app/(app)/(tabs)/account/account.en.json";
import accountCs from "@/app/(app)/(tabs)/account/account.cs.json";
import advertiserDrawerEn from "@/components/drawer/AdvertiserDrawer.en.json";
import advertiserDrawerCs from "@/components/drawer/AdvertiserDrawer.cs.json";
import settingsAdvertiserEn from "@/app/(app)/settings/settings.en.json";
import settingsAdvertiserCs from "@/app/(app)/settings/settings.cs.json";
import settingsEmailEn from "@/app/(app)/settings/email/email.en.json";
import settingsEmailCs from "@/app/(app)/settings/email/email.cs.json";
import settingsSecurityEn from "@/app/(app)/settings/security/security.en.json";
import settingsSecurityCs from "@/app/(app)/settings/security/security.cs.json";
import settingsReferralsEn from "@/app/(app)/settings/referrals/referrals.en.json";
import settingsReferralsCs from "@/app/(app)/settings/referrals/referrals.cs.json";
import settingsPreferencesEn from "@/app/(app)/settings/preferences/preferences.en.json";
import settingsPreferencesCs from "@/app/(app)/settings/preferences/preferences.cs.json";
import settingsNotificationsEn from "@/components/settings/NotificationSettings/NotificationSettings.en.json";
import settingsNotificationsCs from "@/components/settings/NotificationSettings/NotificationSettings.cs.json";
import settingsDeleteEn from "@/app/(app)/settings/delete/delete.en.json";
import settingsDeleteCs from "@/app/(app)/settings/delete/delete.cs.json";
import setupPaymentEn from "@/app/(app)/setup/payment/payment.en.json";
import setupPaymentCs from "@/app/(app)/setup/payment/payment.cs.json";
import billingEn from "@/components/billing/billing.en.json";
import billingCs from "@/components/billing/billing.cs.json";
import paygSheetEn from "@/components/billing/PaygSheet/PaygSheet.en.json";
import paygSheetCs from "@/components/billing/PaygSheet/PaygSheet.cs.json";
import addCreditsSheetEn from "@/components/billing/AddCreditsSheet/AddCreditsSheet.en.json";
import addCreditsSheetCs from "@/components/billing/AddCreditsSheet/AddCreditsSheet.cs.json";
import monthlyTopUpSheetEn from "@/components/billing/MonthlyTopUpSheet/MonthlyTopUpSheet.en.json";
import monthlyTopUpSheetCs from "@/components/billing/MonthlyTopUpSheet/MonthlyTopUpSheet.cs.json";
import cardSheetEn from "@/components/billing/CardSheet/CardSheet.en.json";
import cardSheetCs from "@/components/billing/CardSheet/CardSheet.cs.json";
import fundingSurfaceEn from "@/components/billing/FundingSurface/FundingSurface.en.json";
import fundingSurfaceCs from "@/components/billing/FundingSurface/FundingSurface.cs.json";
import settleBalanceSheetEn from "@/components/billing/SettleBalanceSheet/SettleBalanceSheet.en.json";
import settleBalanceSheetCs from "@/components/billing/SettleBalanceSheet/SettleBalanceSheet.cs.json";
import budgetCardEn from "@/components/billing/BudgetCard/BudgetCard.en.json";
import budgetCardCs from "@/components/billing/BudgetCard/BudgetCard.cs.json";
import noBusinessCardEn from "@/components/businesses/NoBusinessCard/NoBusinessCard.en.json";
import noBusinessCardCs from "@/components/businesses/NoBusinessCard/NoBusinessCard.cs.json";
import setupBusinessEn from "@/app/(app)/setup/business-page/business-page.en.json";
import setupBusinessCs from "@/app/(app)/setup/business-page/business-page.cs.json";
import createBusinessScreenEn from "@/app/(app)/businesses/create/create.en.json";
import createBusinessScreenCs from "@/app/(app)/businesses/create/create.cs.json";
import businessDetailsEn from "@/app/(app)/businesses/[uid]/businessDetails.en.json";
import businessDetailsCs from "@/app/(app)/businesses/[uid]/businessDetails.cs.json";
import bannedBusinessNoticeEn from "@/components/businesses/BannedBusinessNotice/BannedBusinessNotice.en.json";
import bannedBusinessNoticeCs from "@/components/businesses/BannedBusinessNotice/BannedBusinessNotice.cs.json";
import businessesListEn from "@/app/(app)/businesses/businesses.en.json";
import businessesListCs from "@/app/(app)/businesses/businesses.cs.json";
import businessSettingsEn from "@/app/(app)/businesses/[uid]/settings/businessSettings.en.json";
import businessSettingsCs from "@/app/(app)/businesses/[uid]/settings/businessSettings.cs.json";
import sharesEn from "@/components/shares/shared/shares.en.json";
import sharesCs from "@/components/shares/shared/shares.cs.json";
import shareAssessmentSheetEn from "@/components/shares/ShareAssessmentSheet/ShareAssessmentSheet.en.json";
import shareAssessmentSheetCs from "@/components/shares/ShareAssessmentSheet/ShareAssessmentSheet.cs.json";
import advertiserSharesEn from "@/app/(app)/shares/shares.en.json";
import advertiserSharesCs from "@/app/(app)/shares/shares.cs.json";
import shareDetailEn from "@/app/(app)/shares/[uid]/shareDetail.en.json";
import shareDetailCs from "@/app/(app)/shares/[uid]/shareDetail.cs.json";
import lockedBudgetSheetEn from "@/components/billing/LockedBudgetSheet/LockedBudgetSheet.en.json";
import lockedBudgetSheetCs from "@/components/billing/LockedBudgetSheet/LockedBudgetSheet.cs.json";
import visibilitySheetEn from "@/components/billing/VisibilitySheet/VisibilitySheet.en.json";
import visibilitySheetCs from "@/components/billing/VisibilitySheet/VisibilitySheet.cs.json";
import visibilityCardEn from "@/components/billing/VisibilityCard/VisibilityCard.en.json";
import visibilityCardCs from "@/components/billing/VisibilityCard/VisibilityCard.cs.json";
import transactionPreviewEn from "@/components/billing/TransactionPreview/TransactionPreview.en.json";
import transactionPreviewCs from "@/components/billing/TransactionPreview/TransactionPreview.cs.json";
import transactionsEn from "@/app/(app)/transactions/transactions.en.json";
import transactionsCs from "@/app/(app)/transactions/transactions.cs.json";
import referralsEn from "@/app/(app)/referrals/referrals.en.json";
import referralsCs from "@/app/(app)/referrals/referrals.cs.json";
import notFoundEn from "@/app/notFound.en.json";
import notFoundCs from "@/app/notFound.cs.json";

registerLocale("onboarding", { en: onboardingEn, cs: onboardingCs });
registerLocale("signIn", { en: signInEn, cs: signInCs });
registerLocale("onboardingContext", {
  en: onboardingContextEn,
  cs: onboardingContextCs,
});
registerLocale("otp", { en: otpEn, cs: otpCs });
registerLocale("notifications", { en: notificationsEn, cs: notificationsCs });
registerLocale("consent", { en: consentEn, cs: consentCs });
registerLocale("finishing", { en: finishingEn, cs: finishingCs });
registerLocale("tabs", { en: tabsEn, cs: tabsCs });
registerLocale("home", { en: homeEn, cs: homeCs });
registerLocale("wallet", { en: walletEn, cs: walletCs });
registerLocale("account", { en: accountEn, cs: accountCs });
registerLocale("advertiserDrawer", {
  en: advertiserDrawerEn,
  cs: advertiserDrawerCs,
});
registerLocale("settingsAdvertiser", {
  en: settingsAdvertiserEn,
  cs: settingsAdvertiserCs,
});
registerLocale("settingsEmail", {
  en: settingsEmailEn,
  cs: settingsEmailCs,
});
registerLocale("settingsSecurity", {
  en: settingsSecurityEn,
  cs: settingsSecurityCs,
});
registerLocale("settingsReferrals", {
  en: settingsReferralsEn,
  cs: settingsReferralsCs,
});
registerLocale("settingsPreferences", {
  en: settingsPreferencesEn,
  cs: settingsPreferencesCs,
});
registerLocale("settingsNotifications", {
  en: settingsNotificationsEn,
  cs: settingsNotificationsCs,
});
registerLocale("settingsDelete", {
  en: settingsDeleteEn,
  cs: settingsDeleteCs,
});
registerLocale("setupPayment", { en: setupPaymentEn, cs: setupPaymentCs });
registerLocale("billing", { en: billingEn, cs: billingCs });
registerLocale("paygSheet", { en: paygSheetEn, cs: paygSheetCs });
registerLocale("addCreditsSheet", {
  en: addCreditsSheetEn,
  cs: addCreditsSheetCs,
});
registerLocale("monthlyTopUpSheet", {
  en: monthlyTopUpSheetEn,
  cs: monthlyTopUpSheetCs,
});
registerLocale("cardSheet", { en: cardSheetEn, cs: cardSheetCs });
registerLocale("fundingSurface", {
  en: fundingSurfaceEn,
  cs: fundingSurfaceCs,
});
registerLocale("settleBalanceSheet", {
  en: settleBalanceSheetEn,
  cs: settleBalanceSheetCs,
});
registerLocale("budgetCard", { en: budgetCardEn, cs: budgetCardCs });
registerLocale("noBusinessCard", {
  en: noBusinessCardEn,
  cs: noBusinessCardCs,
});
registerLocale("setupBusiness", { en: setupBusinessEn, cs: setupBusinessCs });
registerLocale("createBusinessScreen", {
  en: createBusinessScreenEn,
  cs: createBusinessScreenCs,
});
registerLocale("businessDetails", {
  en: businessDetailsEn,
  cs: businessDetailsCs,
});
registerLocale("bannedBusinessNotice", {
  en: bannedBusinessNoticeEn,
  cs: bannedBusinessNoticeCs,
});
registerLocale("businessesList", {
  en: businessesListEn,
  cs: businessesListCs,
});
registerLocale("businessSettings", {
  en: businessSettingsEn,
  cs: businessSettingsCs,
});
registerLocale("shares", { en: sharesEn, cs: sharesCs });
registerLocale("shareAssessmentSheet", {
  en: shareAssessmentSheetEn,
  cs: shareAssessmentSheetCs,
});
registerLocale("advertiserShares", {
  en: advertiserSharesEn,
  cs: advertiserSharesCs,
});
registerLocale("shareDetail", { en: shareDetailEn, cs: shareDetailCs });
registerLocale("lockedBudgetSheet", {
  en: lockedBudgetSheetEn,
  cs: lockedBudgetSheetCs,
});
registerLocale("visibilitySheet", {
  en: visibilitySheetEn,
  cs: visibilitySheetCs,
});
registerLocale("visibilityCard", {
  en: visibilityCardEn,
  cs: visibilityCardCs,
});
registerLocale("transactionPreview", {
  en: transactionPreviewEn,
  cs: transactionPreviewCs,
});
registerLocale("transactions", { en: transactionsEn, cs: transactionsCs });
registerLocale("referrals", { en: referralsEn, cs: referralsCs });
registerLocale("notFound", { en: notFoundEn, cs: notFoundCs });

declare module "@tagly/client" {
  interface TaglyI18nResources {
    onboarding: typeof onboardingEn;
    signIn: typeof signInEn;
    onboardingContext: typeof onboardingContextEn;
    otp: typeof otpEn;
    notifications: typeof notificationsEn;
    consent: typeof consentEn;
    finishing: typeof finishingEn;
    tabs: typeof tabsEn;
    home: typeof homeEn;
    wallet: typeof walletEn;
    account: typeof accountEn;
    advertiserDrawer: typeof advertiserDrawerEn;
    settingsAdvertiser: typeof settingsAdvertiserEn;
    settingsEmail: typeof settingsEmailEn;
    settingsSecurity: typeof settingsSecurityEn;
    settingsReferrals: typeof settingsReferralsEn;
    settingsPreferences: typeof settingsPreferencesEn;
    settingsNotifications: typeof settingsNotificationsEn;
    settingsDelete: typeof settingsDeleteEn;
    setupPayment: typeof setupPaymentEn;
    billing: typeof billingEn;
    paygSheet: typeof paygSheetEn;
    addCreditsSheet: typeof addCreditsSheetEn;
    monthlyTopUpSheet: typeof monthlyTopUpSheetEn;
    cardSheet: typeof cardSheetEn;
    fundingSurface: typeof fundingSurfaceEn;
    settleBalanceSheet: typeof settleBalanceSheetEn;
    budgetCard: typeof budgetCardEn;
    noBusinessCard: typeof noBusinessCardEn;
    setupBusiness: typeof setupBusinessEn;
    createBusinessScreen: typeof createBusinessScreenEn;
    businessDetails: typeof businessDetailsEn;
    bannedBusinessNotice: typeof bannedBusinessNoticeEn;
    businessesList: typeof businessesListEn;
    businessSettings: typeof businessSettingsEn;
    shares: typeof sharesEn;
    shareAssessmentSheet: typeof shareAssessmentSheetEn;
    advertiserShares: typeof advertiserSharesEn;
    shareDetail: typeof shareDetailEn;
    lockedBudgetSheet: typeof lockedBudgetSheetEn;
    visibilitySheet: typeof visibilitySheetEn;
    visibilityCard: typeof visibilityCardEn;
    transactionPreview: typeof transactionPreviewEn;
    transactions: typeof transactionsEn;
    referrals: typeof referralsEn;
    notFound: typeof notFoundEn;
  }
}
