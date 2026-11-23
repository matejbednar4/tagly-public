/**
 * Storage keys for tagly-advertiser app.
 *
 * SECURE_KEYS: Use secureStore/secureGet/secureDelete (encrypted keychain)
 * LOCAL_KEYS: Use localStore/localGet/localDelete (AsyncStorage)
 *
 * Mirrors the customer app's split. The registration-flow keys are declared now
 * so the onboarding scaffolding is in place; the real auth slice (see
 * v2.0.0.md §3A) will wire them once the /v2 advertiser auth backend exists.
 */

// Re-export shared keys
export { SHARED_SECURE_KEYS, SHARED_LOCAL_KEYS } from "@tagly/client";

// Advertiser-specific keys that should use secureStorage
export const SECURE_KEYS = {
  REGISTRATION_TOKEN: "registration-token",
} as const;

// Advertiser-specific keys that should use localStorage
export const LOCAL_KEYS = {
  // Set once the user finishes (or skips) the onboarding carousel; lets returning
  // unauthenticated users land straight on the sign-in screen.
  HAS_SEEN_ONBOARDING: "hasSeenOnboarding",
  // Set once the notifications priming step has been shown, so a resumed
  // registration doesn't re-ask. Cleared on sign-in so a future re-onboard asks
  // again.
  PUSH_PROMPTED: "pushPrompted",
  // How many onboarding steps this registration counted before the post-sign-in
  // setup phase, written at finish-registration — lets the setup screens
  // continue the step overline ("3 of 4") across the sign-in boundary. Absent
  // for plain logins (setup then counts as "1 of 2"). Cleared when the setup
  // phase resolves and on sign-out.
  SETUP_STEP_BASE: "setupStepBase",
  // Device-local "skipped" flags for the setup steps. A step shows while its
  // server-derived fact (`funded` / `hasBusinessPage` on /me) is unsatisfied
  // AND its flag is unset — the server stores only real facts; dismissal is a
  // device-level choice. Cleared on sign-out (a different account must not
  // inherit it); a reinstall forgetting a skip is accepted (re-nudges only
  // accounts that never funded / never created a page).
  PAYMENT_SETUP_DISMISSED: "paymentSetupDismissed",
  BUSINESS_SETUP_DISMISSED: "businessSetupDismissed",
  // In-progress CreateBusinessWizard draft (step + fields + picked-media URIs),
  // restored after an app restart. Cleared on successful creation and sign-out.
  CREATE_BUSINESS_DRAFT: "createBusinessDraft",
} as const;
