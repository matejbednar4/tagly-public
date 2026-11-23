import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local storage for non-sensitive data (preferences, UI state, cached values)
 *
 * iOS/Android: Uses AsyncStorage
 *
 * Use this for:
 * - User preferences (theme, language, units)
 * - UI state flags
 * - Cached non-sensitive data
 * - Referral/deep link data
 */

export async function localStore(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function localGet(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function localDelete(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
