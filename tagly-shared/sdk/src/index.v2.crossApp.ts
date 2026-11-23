// v2 crossApp SDK entry point — `@tagly/sdk/v2/crossApp`.
// Clean v2 client functions for public + crossApp endpoints, mirroring backend
// `controllers/v2`. Versioned: deleted wholesale at the next cutover.
// `initSdk`/config still come from `@tagly/sdk/shared` (shared, version-agnostic).

// Public
export * from "./endpoints/v2/public/suggestLocale";
export * from "./endpoints/v2/public/resolveQrSticker";
export * from "./endpoints/v2/public/getPublicStats";

// CrossApp (authed, either app)
export * from "./endpoints/v2/crossApp/feedback";
export * from "./endpoints/v2/crossApp/support";
export * from "./endpoints/v2/crossApp/agreeWithTos";
export * from "./endpoints/v2/crossApp/agreeWithPrivacyPolicy";
export * from "./endpoints/v2/crossApp/logout";
