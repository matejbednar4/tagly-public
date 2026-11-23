import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

/**
 * Returns this device's Expo push token **only if notification permission is
 * already granted** — unlike `requestAndGetExpoToken`, it never prompts. Use on
 * best-effort paths where a permission prompt would be wrong, e.g. disabling the
 * token on logout. Returns null when permission isn't granted or there's no
 * projectId.
 */
export const getExpoTokenIfGranted = async () => {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token ?? null;
};
