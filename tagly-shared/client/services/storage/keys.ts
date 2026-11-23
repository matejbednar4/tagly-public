/**
 * Storage keys used in tagly-shared/client.
 * These are used across both customer and advertiser apps.
 */

// Keys that should use secureStorage (sensitive data)
export const SHARED_SECURE_KEYS = {
  JWT: "jwt",
} as const;

// Keys that should use localStorage (non-sensitive data)
export const SHARED_LOCAL_KEYS = {
  // App settings
  THEME_MODE: "themeMode",
  DISTANCE_UNIT: "distanceUnit",
  DISPLAY_LANGUAGE: "displayLanguage",
  LOCALE_DETECTED: "localeDetected",

  // Referral deep linking: the captured referral code (written by the AppsFlyer
  // bridge, read by attach-referrer during onboarding, cleared on sign-in).
  REFERRAL_PREFILL: "referralPrefill",

  // App store review: one-shot flag set after a positive action (share created),
  // consumed on the next stable screen. No throttle state — the OS caps displays.
  PENDING_REVIEW: "pending_review_prompt",

  // USD→CZK exchange rate cache (for CZ-locale users only)
  USD_CZK_RATE: "usdCzkRate",
} as const;
