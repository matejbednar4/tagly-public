/**
 * Storage keys for tagly-admin.
 *
 * SECURE_KEYS: Use secureStore/secureGet/secureDelete (encrypted keychain)
 * LOCAL_KEYS: Use localStore/localGet/localDelete (AsyncStorage)
 */
export { SHARED_SECURE_KEYS, SHARED_LOCAL_KEYS } from "@tagly/client";

export const LOCAL_KEYS = {
  /** Typed draft of the admin create-business wizard (see CreateBusinessWizard). */
  ADMIN_CREATE_BUSINESS_DRAFT: "ADMIN_CREATE_BUSINESS_DRAFT",
} as const;
