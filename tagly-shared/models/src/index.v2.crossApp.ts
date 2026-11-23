// v2 crossApp entry point — `@tagly/models/v2/crossApp`.
// Clean v2 contracts for public + crossApp endpoints, mirroring backend
// `controllers/v2`. Versioned: deleted wholesale at the next cutover. Shared
// building blocks (enums, UIDs, SupportedLocale, ApiError) remain in `core/`
// and are imported from `@tagly/models/shared`.

// Public
export * from "./endpoints/v2/public/suggestLocale";

// CrossApp (authed, either app)
export * from "./endpoints/v2/crossApp/feedback";
export * from "./endpoints/v2/crossApp/support";
export * from "./endpoints/v2/crossApp/agreeWithTos";
export * from "./endpoints/v2/crossApp/agreeWithPrivacyPolicy";
export * from "./endpoints/v2/crossApp/logout";

// Me — notification settings DTO (shared by the customer + advertiser screens)
export * from "./dtos/v2/crossApp/me/notifications/notificationSettings";

// Common DTOs (shared across apps)
export * from "./dtos/v2/crossApp/common/interest";
export * from "./dtos/v2/crossApp/common/media";
export * from "./dtos/v2/crossApp/common/businessType";
export * from "./dtos/v2/crossApp/common/businessProfile";
export * from "./dtos/v2/crossApp/common/openingHoursPeriod";

// Shares — unified insights (consumed by the v2 share-detail surface when built)
export * from "./dtos/v2/crossApp/shares/shareInsights";

// Public — QR sticker → business resolution (tagly-join landing personalization)
export * from "./endpoints/v2/public/resolveQrSticker";
export * from "./endpoints/v2/public/getPublicStats";
