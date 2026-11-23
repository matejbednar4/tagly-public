// ─────────────────────────────────────────────────────────────────────────────
// @tagly/client — shared React-Native client package (merged design + utils).
// Design system exports first, then cross-app utilities. Subpath exports
// (CustomMedia / FullscreenMediaGallery) live in package.json.
// ─────────────────────────────────────────────────────────────────────────────

export * from "./theme";
export * from "./theme/fonts";
export * from "./theme/colorUtils";
export * from "./utils/pressFeedback";

// Alert: the .native impl is theme-clean; Metro picks it on the (native) customer app.
export * from "./components/feedback/alert";

// ── v2 migrated to the new theme (un-comment as each is rebuilt) ──
export * from "./components/primitives/CustomButton";
export * from "./components/primitives/CustomTextInput";
export * from "./components/primitives/Loading";
export * from "./components/primitives/OtpInput";
export * from "./components/primitives/RefreshButton";
export * from "./components/primitives/Toggle";
export * from "./components/primitives/StarRating";
export * from "./components/overlays/BottomSheet";
export * from "./components/feedback/AppToast";
export * from "./components/feedback/RewardCalculatingIndicator";
export * from "./components/feedback/RewardEstimatePendingNotice";
export * from "./components/feedback/LocationPermissionNotice";
export * from "./components/feedback/NoticeStack";
export * from "./components/feedback/RewardInfoSheet";
export * from "./components/feedback/FeedbackSheet";
export * from "./components/feedback/AboutSheet";
export * from "./components/support/SupportSheet";
export * from "./components/layout/SectionHeader";
export * from "./components/layout/StepProgressOverline";
export * from "./components/forms/SettingCard";
export * from "./components/forms/EditableSetting";
export * from "./components/lists/GeneralVerticalList";
export * from "./components/lists/HorizontalSnapList";
export * from "./components/lists/PaginatedList";
export * from "./api/makeOffsetFetcher";
export * from "./components/UpdateRequiredScreen";

// ─────────────────────────────────────────────────────────────────────────────
// v2.0.0 REBUILD — everything below still uses the OLD design tokens
// (colors.contrast / textStyles.* / the deleted ../theme/spacing module) and is
// commented out so @tagly/client resolves against the new theme. Un-comment each
// line as that component is migrated to `useTheme().theme` (see v2.0.0.md §2).
// ─────────────────────────────────────────────────────────────────────────────
// export * from "./components/PageLoading";
// CustomMedia and FullscreenMediaGallery have platform-specific implementations (.web.tsx, .native.tsx)
// Import directly: import { CustomMedia } from "@tagly/client/components/media/CustomMedia"
// export * from "./components/misc/Divider";
// export * from "./components/overlays/BottomOverlay";
// export * from "./components/overlays/FullScreenMessage";
// export * from "./components/overlays/LocaleSelectorOverlay";
// export * from "./contexts/LocaleSelection";
export * from "./contexts/BusinessMapCacheContext";
// export * from "./components/ChangeLocaleButton";
// export * from "./components/previews/LocalPreviewNormal";
export * from "./components/pickers/CustomPicker";
export * from "./components/pickers/InterestsPicker";
export * from "./components/pickers/LocalePicker";
export * from "./components/pickers/LanguagePicker";
// export * from "./components/pickers/InterestsSelector";
// export * from "./components/pickers/TypeSelector";

// export * from "./components/details/LocalDetails";
// export * from "./components/details/ShareDetails";
// export { getReportTypeLabel } from "./components/details/ShareDetails/utils";

// export * from "./components/lists/SharesListH";
// export * from "./components/lists/SubaccountsListH";
// export * from "./components/lists/SubaccountsListSmallH";

// export * from "./components/media/MediaAbsoluteOverlay";
// export * from "./components/balance/BalanceChanges";

// export * from "./components/lists/GeneralVerticalList";
// export * from "./components/lists/GeneralHorizontalList";
export * from "./components/overlays/AcceptLatestTosModal";
// export * from "./components/overlays/UpdateRequiredModal";
// export * from "./components/referral/ReferralStatisticsComponent";

export * from "./components/overlays/AcceptLatestPrivacyPolicyModal";
// export * from "./components/previews/CustomerLedgerEventPreviewSmall";
// export * from "./components/previews/AdvertiserLedgerEventPreviewSmall";

// export * from "./components/guides/InstagramTagOptions";
// export * from "./components/guides/OtherBusinessNamesInfo";
export * from "./components/maps/MapMarkerComponent";
export * from "./components/maps/MapControls";
export * from "./components/maps/BusinessMap";
export * from "./components/previews/BusinessPreview";
export * from "./components/previews/InstagramStoryPreview";

// Business page create/edit — the shared step forms (advertiser + admin) and
// the create wizard over them (api-injected; see CreateBusinessWizardApi).
export * from "./components/businesses/pageForm/StepShell";
export * from "./components/businesses/pageForm/StepBasics";
export * from "./components/businesses/pageForm/StepMedia";
export * from "./components/businesses/pageForm/StepDetails";
export * from "./components/businesses/pageForm/formMappers";
export * from "./components/businesses/pageForm/formErrorAlert";
export * from "./components/businesses/CreateBusinessWizard";
export * from "./components/businesses/BusinessTagChips";

// export * from "./components/statistics/StatisticCard";

export * from "./components/primitives/PressableText";

// Drawer — shared open/close state + slide-in shell (apps inject the content).
export * from "./components/drawer/DrawerContext";
export * from "./components/drawer/SideDrawer";

// Navigation — centralized design, app-injected tabs/actions (both mobile apps).
export * from "./components/navigation/TopMenu";
export * from "./components/navigation/BottomActionBar";
export * from "./components/navigation/BottomNavigation";
export * from "./components/navigation/ZoomOnFocus";

// export * from "./components/navigation/AnimatedTabItem";

// export * from "./components/forms/CreateLocalFormBase";
// export * from "./components/forms/ConsentRow";
// export * from "./components/media/webPickMedia";

// ── Utilities ────────────────────────────────────────────────────────────────
export * from "./api/caller";

export * from "./services/auth/socialSignIn";

export * from "./utils/geo/calculateDistance";

export * from "./utils/formatting/formatBudget";
export * from "./utils/formatting/formatDate";
export * from "./utils/formatting/formatTimeOfDay";
export * from "./utils/formatting/isBusinessOpenNow";

export * from "./services/storage/secureStorage";
export * from "./services/storage/localStorage";
export * from "./services/storage/keys";
export * from "./services/reviews/requestStoreReview";

export * from "./hooks/useDetailQuery";
export * from "./hooks/useOnAppResume";
export * from "./hooks/useStaleResume";
export * from "./hooks/usePagedList";
export * from "./hooks/useFormatBudget";
export * from "./hooks/useCooldown";
export * from "./hooks/useTimeRemaining";
export * from "./hooks/useInitCurrentLocation";
export * from "./hooks/useBlockBackWhile";
export * from "./hooks/usePushOpenedListener";

export * from "./services/permissions/hasNotificationsEnabled";
export * from "./services/permissions/requestAndGetExpoToken";
export * from "./services/permissions/getExpoTokenIfGranted";
export * from "./services/permissions/getPushPermissionGranted";
export * from "./services/permissions/requestPhotoLibraryPermission";
export * from "./services/permissions/requestLocationPermission";
export * from "./services/permissions/openAppSettingsAlert";
export * from "./services/device/getDeviceId";

export * from "./utils/media/withQualityCdnUrlFromKey";

export * from "./services/links/openTermsOfService";
export * from "./services/links/openPrivacyPolicy";
export * from "./services/links/openTermsOfMonetization";
export * from "./services/links/openInstagramStoryCamera";
export * from "./services/links/openInstagramDataDeletion";

export * from "./services/attribution/appsFlyerBridge";
export * from "./services/attribution/parseInboundReferral";


export * from "./services/uploads/uploadPresigned";
export * from "./services/media/pickMedia";
export * from "./utils/composeProviders";

export * from "./components/feedback/toast";

export * from "./i18n/detectLocale";
export { i18n, setAppLanguage, registerLocale } from "./i18n/index";
export type { TaglyI18nResources } from "./i18n/index";
export * from "./i18n/useCatalogLocalizer";

export * from "./contexts/ExchangeRateContext";
export * from "./contexts/CurrentLocationContext";
export * from "./contexts/UserPreferencesContext";
