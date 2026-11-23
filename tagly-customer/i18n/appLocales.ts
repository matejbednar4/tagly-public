/**
 * Customer-app colocated i18n registry.
 *
 * The shared `@tagly/client` singleton bundles the central `locales/` namespaces.
 * This file registers the customer app's **colocated** namespaces — those whose
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

import appShellEn from "@/app/(app)/appShell.en.json";
import appShellCs from "@/app/(app)/appShell.cs.json";
import onboardingContextEn from "@/contexts/onboarding/OnboardingContext.en.json";
import onboardingContextCs from "@/contexts/onboarding/OnboardingContext.cs.json";
import onboardingEn from "@/components/onboarding/Welcome/Welcome.en.json";
import onboardingCs from "@/components/onboarding/Welcome/Welcome.cs.json";
import signInEn from "@/components/onboarding/SignIn/SignIn.en.json";
import signInCs from "@/components/onboarding/SignIn/SignIn.cs.json";
import otpEn from "@/app/(onboarding)/otp/otp.en.json";
import otpCs from "@/app/(onboarding)/otp/otp.cs.json";
import consentEn from "@/app/(onboarding)/consent/consent.en.json";
import consentCs from "@/app/(onboarding)/consent/consent.cs.json";
import profileEn from "@/app/(onboarding)/profile/profile.en.json";
import profileCs from "@/app/(onboarding)/profile/profile.cs.json";
import instagramEn from "@/app/(onboarding)/instagram/instagram.en.json";
import instagramCs from "@/app/(onboarding)/instagram/instagram.cs.json";
import notificationsEn from "@/app/(onboarding)/notifications/notifications.en.json";
import notificationsCs from "@/app/(onboarding)/notifications/notifications.cs.json";
// In-app (post-onboarding) namespaces.
import tabsEn from "@/app/(app)/(tabs)/tabs.en.json";
import tabsCs from "@/app/(app)/(tabs)/tabs.cs.json";
import discoverEn from "@/app/(app)/(tabs)/discover/discover.en.json";
import discoverCs from "@/app/(app)/(tabs)/discover/discover.cs.json";
import browseBusinessesEn from "@/app/(app)/businesses/browseBusinesses.en.json";
import browseBusinessesCs from "@/app/(app)/businesses/browseBusinesses.cs.json";
import accountEn from "@/app/(app)/(tabs)/account/account.en.json";
import accountCs from "@/app/(app)/(tabs)/account/account.cs.json";
import sharesEn from "@/app/(app)/shares/shares.en.json";
import sharesCs from "@/app/(app)/shares/shares.cs.json";
import visitedEn from "@/app/(app)/visited/visited.en.json";
import visitedCs from "@/app/(app)/visited/visited.cs.json";
import transactionsEn from "@/app/(app)/transactions/transactions.en.json";
import transactionsCs from "@/app/(app)/transactions/transactions.cs.json";
import shareDetailsEn from "@/app/(app)/shares/[uid]/shareDetails.en.json";
import shareDetailsCs from "@/app/(app)/shares/[uid]/shareDetails.cs.json";
import createShareEn from "@/app/(app)/shares/create/createShare.en.json";
import createShareCs from "@/app/(app)/shares/create/createShare.cs.json";
import confirmShareEn from "@/app/(app)/shares/create/confirm/confirmShare.en.json";
import confirmShareCs from "@/app/(app)/shares/create/confirm/confirmShare.cs.json";
import createShareTagEn from "@/app/(app)/shares/create/tag/createShareTag.en.json";
import createShareTagCs from "@/app/(app)/shares/create/tag/createShareTag.cs.json";
import businessDetailsEn from "@/app/(app)/businesses/[uid]/businessDetails.en.json";
import businessDetailsCs from "@/app/(app)/businesses/[uid]/businessDetails.cs.json";
import settingsEn from "@/app/(app)/settings/settings.en.json";
import settingsCs from "@/app/(app)/settings/settings.cs.json";
import settingsProfileEn from "@/app/(app)/settings/profile/profile.en.json";
import settingsProfileCs from "@/app/(app)/settings/profile/profile.cs.json";
import settingsReferralsEn from "@/app/(app)/settings/referrals/referrals.en.json";
import settingsReferralsCs from "@/app/(app)/settings/referrals/referrals.cs.json";
import settingsSecurityEn from "@/app/(app)/settings/security/security.en.json";
import settingsSecurityCs from "@/app/(app)/settings/security/security.cs.json";
import settingsEmailEn from "@/app/(app)/settings/email/email.en.json";
import settingsEmailCs from "@/app/(app)/settings/email/email.cs.json";
import settingsDeleteEn from "@/app/(app)/settings/delete/delete.en.json";
import settingsDeleteCs from "@/app/(app)/settings/delete/delete.cs.json";
import settingsInstagramEn from "@/app/(app)/settings/instagram/instagram.en.json";
import settingsInstagramCs from "@/app/(app)/settings/instagram/instagram.cs.json";
import settingsStripeEn from "@/app/(app)/settings/stripe/stripe.en.json";
import settingsStripeCs from "@/app/(app)/settings/stripe/stripe.cs.json";
import settingsPreferencesEn from "@/app/(app)/settings/preferences/preferences.en.json";
import settingsPreferencesCs from "@/app/(app)/settings/preferences/preferences.cs.json";
import settingsNotificationsEn from "@/components/settings/NotificationSettings/NotificationSettings.en.json";
import settingsNotificationsCs from "@/components/settings/NotificationSettings/NotificationSettings.cs.json";
import withdrawEn from "@/app/(app)/withdraw/withdraw.en.json";
import withdrawCs from "@/app/(app)/withdraw/withdraw.cs.json";
import withdrawFormEn from "@/components/withdraw/WithdrawForm/WithdrawForm.en.json";
import withdrawFormCs from "@/components/withdraw/WithdrawForm/WithdrawForm.cs.json";
import withdrawalsInfoEn from "@/components/withdraw/WithdrawalsInfoSheet/WithdrawalsInfoSheet.en.json";
import withdrawalsInfoCs from "@/components/withdraw/WithdrawalsInfoSheet/WithdrawalsInfoSheet.cs.json";
import referralsEn from "@/app/(app)/referrals/referrals.en.json";
import referralsCs from "@/app/(app)/referrals/referrals.cs.json";
import shareCardEn from "@/components/shares/ShareCard.en.json";
import shareCardCs from "@/components/shares/ShareCard.cs.json";
import transactionPreviewEn from "@/components/transactions/TransactionPreview.en.json";
import transactionPreviewCs from "@/components/transactions/TransactionPreview.cs.json";
import customerDrawerEn from "@/components/drawer/CustomerDrawer.en.json";
import customerDrawerCs from "@/components/drawer/CustomerDrawer.cs.json";
import instagramConnectionEn from "@/contexts/instagram/InstagramConnectionContext.en.json";
import instagramConnectionCs from "@/contexts/instagram/InstagramConnectionContext.cs.json";
import instagramConnectionPromptEn from "@/components/instagram/InstagramConnectionPrompt.en.json";
import instagramConnectionPromptCs from "@/components/instagram/InstagramConnectionPrompt.cs.json";
import instagramPermissionEn from "@/components/instagram/InstagramPermissionSheet/InstagramPermissionSheet.en.json";
import instagramPermissionCs from "@/components/instagram/InstagramPermissionSheet/InstagramPermissionSheet.cs.json";
import notFoundEn from "@/app/notFound.en.json";
import notFoundCs from "@/app/notFound.cs.json";
// IG auth-flow strings — colocated next to each consumer.
import androidInstagramAuthEn from "@/contexts/instagram/AndroidInstagramAuthContext.en.json";
import androidInstagramAuthCs from "@/contexts/instagram/AndroidInstagramAuthContext.cs.json";
import instagramAuthFlowEn from "@/hooks/useInstagramAuthFlow.en.json";
import instagramAuthFlowCs from "@/hooks/useInstagramAuthFlow.cs.json";
import createShareErrorsEn from "@/hooks/useCreateShare.en.json";
import createShareErrorsCs from "@/hooks/useCreateShare.cs.json";
import storyViewsEn from "@/components/storyViews/StoryViewsModal/StoryViewsModal.en.json";
import storyViewsCs from "@/components/storyViews/StoryViewsModal/StoryViewsModal.cs.json";
import shareOpportunityEn from "@/components/shareOpportunity/ShareOpportunitySheet/ShareOpportunitySheet.en.json";
import shareOpportunityCs from "@/components/shareOpportunity/ShareOpportunitySheet/ShareOpportunitySheet.cs.json";

registerLocale("onboarding", { en: onboardingEn, cs: onboardingCs });
registerLocale("signIn", { en: signInEn, cs: signInCs });
registerLocale("otp", { en: otpEn, cs: otpCs });
registerLocale("consent", { en: consentEn, cs: consentCs });
registerLocale("profile", { en: profileEn, cs: profileCs });
registerLocale("instagram", { en: instagramEn, cs: instagramCs });
registerLocale("notifications", { en: notificationsEn, cs: notificationsCs });
registerLocale("tabs", { en: tabsEn, cs: tabsCs });
registerLocale("discover", { en: discoverEn, cs: discoverCs });
registerLocale("browseBusinesses", {
  en: browseBusinessesEn,
  cs: browseBusinessesCs,
});
registerLocale("appShell", { en: appShellEn, cs: appShellCs });
registerLocale("onboardingContext", {
  en: onboardingContextEn,
  cs: onboardingContextCs,
});
registerLocale("account", { en: accountEn, cs: accountCs });
registerLocale("shares", { en: sharesEn, cs: sharesCs });
registerLocale("visited", { en: visitedEn, cs: visitedCs });
registerLocale("transactions", { en: transactionsEn, cs: transactionsCs });
registerLocale("shareDetails", { en: shareDetailsEn, cs: shareDetailsCs });
registerLocale("createShare", { en: createShareEn, cs: createShareCs });
registerLocale("confirmShare", { en: confirmShareEn, cs: confirmShareCs });
registerLocale("useCreateShare", {
  en: createShareErrorsEn,
  cs: createShareErrorsCs,
});
registerLocale("createShareTag", {
  en: createShareTagEn,
  cs: createShareTagCs,
});
registerLocale("businessDetails", {
  en: businessDetailsEn,
  cs: businessDetailsCs,
});
registerLocale("settings", { en: settingsEn, cs: settingsCs });
registerLocale("settingsProfile", {
  en: settingsProfileEn,
  cs: settingsProfileCs,
});
registerLocale("settingsReferrals", {
  en: settingsReferralsEn,
  cs: settingsReferralsCs,
});
registerLocale("settingsSecurity", {
  en: settingsSecurityEn,
  cs: settingsSecurityCs,
});
registerLocale("settingsEmail", {
  en: settingsEmailEn,
  cs: settingsEmailCs,
});
registerLocale("settingsDelete", {
  en: settingsDeleteEn,
  cs: settingsDeleteCs,
});
registerLocale("settingsInstagram", {
  en: settingsInstagramEn,
  cs: settingsInstagramCs,
});
registerLocale("settingsStripe", {
  en: settingsStripeEn,
  cs: settingsStripeCs,
});
registerLocale("settingsPreferences", {
  en: settingsPreferencesEn,
  cs: settingsPreferencesCs,
});
registerLocale("settingsNotifications", {
  en: settingsNotificationsEn,
  cs: settingsNotificationsCs,
});
registerLocale("withdraw", { en: withdrawEn, cs: withdrawCs });
registerLocale("withdrawForm", { en: withdrawFormEn, cs: withdrawFormCs });
registerLocale("withdrawalsInfo", {
  en: withdrawalsInfoEn,
  cs: withdrawalsInfoCs,
});
registerLocale("referrals", { en: referralsEn, cs: referralsCs });
registerLocale("shareCard", { en: shareCardEn, cs: shareCardCs });
registerLocale("transactionPreview", {
  en: transactionPreviewEn,
  cs: transactionPreviewCs,
});
registerLocale("customerDrawer", { en: customerDrawerEn, cs: customerDrawerCs });
registerLocale("instagramConnection", {
  en: instagramConnectionEn,
  cs: instagramConnectionCs,
});
registerLocale("instagramConnectionPrompt", {
  en: instagramConnectionPromptEn,
  cs: instagramConnectionPromptCs,
});
registerLocale("instagramPermission", {
  en: instagramPermissionEn,
  cs: instagramPermissionCs,
});
registerLocale("notFound", { en: notFoundEn, cs: notFoundCs });
registerLocale("androidInstagramAuth", {
  en: androidInstagramAuthEn,
  cs: androidInstagramAuthCs,
});
registerLocale("instagramAuthFlow", {
  en: instagramAuthFlowEn,
  cs: instagramAuthFlowCs,
});
registerLocale("storyViews", { en: storyViewsEn, cs: storyViewsCs });
registerLocale("shareOpportunity", {
  en: shareOpportunityEn,
  cs: shareOpportunityCs,
});

declare module "@tagly/client" {
  interface TaglyI18nResources {
    onboarding: typeof onboardingEn;
    signIn: typeof signInEn;
    otp: typeof otpEn;
    consent: typeof consentEn;
    profile: typeof profileEn;
    instagram: typeof instagramEn;
    notifications: typeof notificationsEn;
    tabs: typeof tabsEn;
    discover: typeof discoverEn;
    browseBusinesses: typeof browseBusinessesEn;
    appShell: typeof appShellEn;
    onboardingContext: typeof onboardingContextEn;
    account: typeof accountEn;
    shares: typeof sharesEn;
    visited: typeof visitedEn;
    transactions: typeof transactionsEn;
    shareDetails: typeof shareDetailsEn;
    createShare: typeof createShareEn;
    confirmShare: typeof confirmShareEn;
    useCreateShare: typeof createShareErrorsEn;
    createShareTag: typeof createShareTagEn;
    businessDetails: typeof businessDetailsEn;
    settings: typeof settingsEn;
    settingsProfile: typeof settingsProfileEn;
    settingsReferrals: typeof settingsReferralsEn;
    settingsSecurity: typeof settingsSecurityEn;
    settingsEmail: typeof settingsEmailEn;
    settingsDelete: typeof settingsDeleteEn;
    settingsInstagram: typeof settingsInstagramEn;
    settingsStripe: typeof settingsStripeEn;
    settingsPreferences: typeof settingsPreferencesEn;
    settingsNotifications: typeof settingsNotificationsEn;
    withdraw: typeof withdrawEn;
    withdrawForm: typeof withdrawFormEn;
    withdrawalsInfo: typeof withdrawalsInfoEn;
    referrals: typeof referralsEn;
    shareCard: typeof shareCardEn;
    transactionPreview: typeof transactionPreviewEn;
    customerDrawer: typeof customerDrawerEn;
    instagramConnection: typeof instagramConnectionEn;
    instagramConnectionPrompt: typeof instagramConnectionPromptEn;
    instagramPermission: typeof instagramPermissionEn;
    notFound: typeof notFoundEn;
    androidInstagramAuth: typeof androidInstagramAuthEn;
    instagramAuthFlow: typeof instagramAuthFlowEn;
    storyViews: typeof storyViewsEn;
    shareOpportunity: typeof shareOpportunityEn;
  }
}
