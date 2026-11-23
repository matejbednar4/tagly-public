import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import dayjs from "dayjs";
import "dayjs/locale/cs";
import "dayjs/locale/en";
import type { Language } from "./detectLocale";

export type { Language } from "./detectLocale";

// ─────────────────────────────────────────────────────────────────────────────
// Colocated namespaces only. tagly-shared/client components own their strings in a
// `*.en.json` / `*.cs.json` pair NEXT TO the component; there is no central
// `locales/` catalog. App-owned strings live in each app's own colocated files,
// registered at boot via `registerLocale` (see e.g. tagly-customer/i18n/appLocales).
// ─────────────────────────────────────────────────────────────────────────────
import enApiErrors from "../api/apiErrors.en.json";
import csApiErrors from "../api/apiErrors.cs.json";
import enMap from "../components/maps/map.en.json";
import csMap from "../components/maps/map.cs.json";
import enBusinessPreview from "../components/previews/BusinessPreview/BusinessPreview.en.json";
import csBusinessPreview from "../components/previews/BusinessPreview/BusinessPreview.cs.json";
import enInstagramStoryPreview from "../components/previews/InstagramStoryPreview/InstagramStoryPreview.en.json";
import csInstagramStoryPreview from "../components/previews/InstagramStoryPreview/InstagramStoryPreview.cs.json";
import enRewardEstimatePending from "../components/feedback/RewardEstimatePendingNotice/RewardEstimatePendingNotice.en.json";
import csRewardEstimatePending from "../components/feedback/RewardEstimatePendingNotice/RewardEstimatePendingNotice.cs.json";
import enGeneralList from "../components/lists/GeneralVerticalList/GeneralVerticalList.en.json";
import csGeneralList from "../components/lists/GeneralVerticalList/GeneralVerticalList.cs.json";
import enSectionHeader from "../components/layout/SectionHeader/SectionHeader.en.json";
import csSectionHeader from "../components/layout/SectionHeader/SectionHeader.cs.json";
import enRewardInfo from "../components/feedback/RewardInfoSheet/RewardInfoSheet.en.json";
import csRewardInfo from "../components/feedback/RewardInfoSheet/RewardInfoSheet.cs.json";
import enEditableSetting from "../components/forms/EditableSetting/EditableSetting.en.json";
import csEditableSetting from "../components/forms/EditableSetting/EditableSetting.cs.json";
import enAcceptTos from "../components/overlays/AcceptLatestTosModal/AcceptLatestTosModal.en.json";
import csAcceptTos from "../components/overlays/AcceptLatestTosModal/AcceptLatestTosModal.cs.json";
import enAcceptPrivacy from "../components/overlays/AcceptLatestPrivacyPolicyModal/AcceptLatestPrivacyPolicyModal.en.json";
import csAcceptPrivacy from "../components/overlays/AcceptLatestPrivacyPolicyModal/AcceptLatestPrivacyPolicyModal.cs.json";
import enLocationPermission from "../components/feedback/LocationPermissionNotice/LocationPermissionNotice.en.json";
import csLocationPermission from "../components/feedback/LocationPermissionNotice/LocationPermissionNotice.cs.json";
import enLocalePicker from "../components/pickers/LocalePicker/LocalePicker.en.json";
import csLocalePicker from "../components/pickers/LocalePicker/LocalePicker.cs.json";
import enLanguagePicker from "../components/pickers/LanguagePicker/LanguagePicker.en.json";
import csLanguagePicker from "../components/pickers/LanguagePicker/LanguagePicker.cs.json";
import enStepProgressOverline from "../components/layout/StepProgressOverline/StepProgressOverline.en.json";
import csStepProgressOverline from "../components/layout/StepProgressOverline/StepProgressOverline.cs.json";
import enFeedbackSheet from "../components/feedback/FeedbackSheet/FeedbackSheet.en.json";
import csFeedbackSheet from "../components/feedback/FeedbackSheet/FeedbackSheet.cs.json";
import enSupportSheet from "../components/support/SupportSheet/SupportSheet.en.json";
import csSupportSheet from "../components/support/SupportSheet/SupportSheet.cs.json";
import enAboutSheet from "../components/feedback/AboutSheet/AboutSheet.en.json";
import csAboutSheet from "../components/feedback/AboutSheet/AboutSheet.cs.json";
import enBusinessTagChips from "../components/businesses/BusinessTagChips/BusinessTagChips.en.json";
import csBusinessTagChips from "../components/businesses/BusinessTagChips/BusinessTagChips.cs.json";
import enBusinessPageForm from "../components/businesses/pageForm/pageForm.en.json";
import csBusinessPageForm from "../components/businesses/pageForm/pageForm.cs.json";
import enPickMedia from "../services/media/pickMedia.en.json";
import csPickMedia from "../services/media/pickMedia.cs.json";
import enPhotoPermission from "../services/permissions/requestPhotoLibraryPermission.en.json";
import csPhotoPermission from "../services/permissions/requestPhotoLibraryPermission.cs.json";

// English is the source of truth: `AppResources` (and all i18next key/namespace
// type-checking) is derived from `enResources`, and `en` is the `fallbackLng`.
// Keep `enResources`/`csResources` in lockstep (same namespaces + keys).
const enResources = {
  apiErrors: enApiErrors,
  map: enMap,
  businessPreview: enBusinessPreview,
  instagramStoryPreview: enInstagramStoryPreview,
  rewardEstimatePending: enRewardEstimatePending,
  generalList: enGeneralList,
  sectionHeader: enSectionHeader,
  rewardInfo: enRewardInfo,
  editableSetting: enEditableSetting,
  acceptTos: enAcceptTos,
  acceptPrivacy: enAcceptPrivacy,
  locationPermission: enLocationPermission,
  localePicker: enLocalePicker,
  languagePicker: enLanguagePicker,
  stepProgressOverline: enStepProgressOverline,
  feedback: enFeedbackSheet,
  support: enSupportSheet,
  about: enAboutSheet,
  businessPageForm: enBusinessPageForm,
  businessTagChips: enBusinessTagChips,
  pickMedia: enPickMedia,
  photoPermission: enPhotoPermission,
} as const;

const csResources = {
  apiErrors: csApiErrors,
  map: csMap,
  businessPreview: csBusinessPreview,
  instagramStoryPreview: csInstagramStoryPreview,
  rewardEstimatePending: csRewardEstimatePending,
  generalList: csGeneralList,
  sectionHeader: csSectionHeader,
  rewardInfo: csRewardInfo,
  editableSetting: csEditableSetting,
  acceptTos: csAcceptTos,
  acceptPrivacy: csAcceptPrivacy,
  locationPermission: csLocationPermission,
  localePicker: csLocalePicker,
  languagePicker: csLanguagePicker,
  stepProgressOverline: csStepProgressOverline,
  feedback: csFeedbackSheet,
  support: csSupportSheet,
  about: csAboutSheet,
  businessPageForm: csBusinessPageForm,
  businessTagChips: csBusinessTagChips,
  pickMedia: csPickMedia,
  photoPermission: csPhotoPermission,
} as const;

/**
 * The shape of tagly-shared/client's bundled namespaces, derived from the English set.
 * Consumed by the `i18next` module augmentation below so `useTranslation(ns)`
 * only accepts real namespaces and `t(key)` only accepts existing keys.
 */
export type AppResources = typeof enResources;

/**
 * Open registry of every i18n namespace. tagly-shared/client's namespaces come from
 * `AppResources`; **colocated app namespaces** (a `*.en.json`/`*.cs.json` pair
 * next to a component, registered with `registerLocale`) add themselves via
 * module augmentation — interface merging means no central edit is needed:
 *
 *   import en from "./MyScreen.en.json";
 *   declare module "@tagly/client" {
 *     interface TaglyI18nResources { myScreen: typeof en }
 *   }
 */
export interface TaglyI18nResources extends AppResources {}

i18n.use(initReactI18next).init({
  resources: { en: enResources, cs: csResources },
  lng: "en",
  fallbackLng: "en",
  // No code calls useTranslation()/t() without an explicit ns; defaultNS only
  // governs the omitted-ns case. Point it at a real bundled namespace.
  defaultNS: "apiErrors",
  interpolation: {
    // React already escapes values
    escapeValue: false,
  },
  // Synchronous init — resources are bundled, no async loading needed
  initImmediate: false,
});

// Keep dayjs's global locale in sync with i18next's initial language so dates
// render in the active language everywhere they're formatted.
dayjs.locale(i18n.language);

export { i18n };

/**
 * Register a colocated namespace's `en`/`cs` bundles with the singleton. Use for
 * namespaces whose JSON lives next to its component; pair it with a
 * `declare module "@tagly/client"` augmentation of `TaglyI18nResources` so `t()`
 * stays type-checked. Call once at app boot (before the namespace renders).
 */
export function registerLocale(
  namespace: string,
  bundles: { en: object; cs: object },
): void {
  i18n.addResourceBundle("en", namespace, bundles.en, true, true);
  i18n.addResourceBundle("cs", namespace, bundles.cs, true, true);
}

/** Switch the active language and trigger re-renders for all useTranslation consumers. */
export function setAppLanguage(lang: Language): void {
  i18n.changeLanguage(lang);
  // Keep date formatting (dayjs) in lockstep with the UI language.
  dayjs.locale(lang);
}

// ── Type-safety for i18next ─────────────────────────────────────────────────
// This augmentation lives here (not a standalone .d.ts) on purpose: both apps
// import `@tagly/client`, which re-exports this file, so it's guaranteed to be in
// each app's TypeScript program.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "apiErrors";
    resources: TaglyI18nResources;
  }
}
