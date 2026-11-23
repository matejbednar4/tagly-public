// Shared catalogs — the single source of truth for slug-keyed enumerable items
// (business types, customer interests, verticals, notification categories/events).
// Both backend and clients read from here; each entry carries enName/csName (or
// {en,cs} fields) inline so consumers can pick a language via pickName /
// pickLocalized helpers.

export * from "./types";
export * from "./pickLocalized";
export * from "./idxBy";
export * from "./humanizeSlug";
export * from "./verticals/verticalsCatalog";
export * from "./verticals/advertiserTypesCatalog";
export * from "./verticals/interestsCatalog";
export * from "./rewards/rewardMessagesCatalog";
export * from "./notifications/notificationCategoriesCatalog";
export * from "./notifications/notificationEventsCatalog";
