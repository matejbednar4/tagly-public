import * as SecureStore from "expo-secure-store";

/**
 * Secure storage for sensitive data (JWT, auth tokens, etc.)
 *
 * iOS/Android: Uses expo-secure-store (Keychain/Keystore)
 *
 * Uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY for maximum persistence:
 * - Survives app reinstalls
 * - Survives passcode changes
 * - Cannot be extracted via backup (more secure)
 * - Accessible after first device unlock (works for background operations)
 */

const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function secureStore(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
}

export async function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
