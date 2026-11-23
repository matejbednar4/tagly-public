/**
 * Storage keys for tagly-customer app.
 *
 * SECURE_KEYS: Use secureStore/secureGet/secureDelete (encrypted keychain)
 * LOCAL_KEYS: Use localStore/localGet/localDelete (AsyncStorage)
 */

// Re-export shared keys
export { SHARED_SECURE_KEYS, SHARED_LOCAL_KEYS } from "@tagly/client";

// Customer-specific keys that should use secureStorage
export const SECURE_KEYS = {
  REGISTRATION_TOKEN: "registration-token",
} as const;

// Customer-specific keys that should use localStorage
export const LOCAL_KEYS = {
  SHOW_INSTAGRAM_INFO: "showInstagramInfo",
  LAST_OPENED_AT: "lastOpenedAt",
  /** Local-only "asked and dismissed" flag for the story-views nudge sheet
   *  (per-device by design; the server value itself syncs across devices). */
  STORY_VIEWS_SKIPPED: "story_views_skipped",
  // Set once the user finishes (or skips) the onboarding carousel; lets returning
  // unauthenticated users land straight on the sign-in screen.
  HAS_SEEN_ONBOARDING: "hasSeenOnboarding",
  // Set once the notifications step has been shown (enabled or skipped); prevents
  // re-showing it when resuming a registration after an app kill. Cleared on
  // sign-in so a future re-registration asks again.
  PUSH_PROMPTED: "pushPrompted",
} as const;
