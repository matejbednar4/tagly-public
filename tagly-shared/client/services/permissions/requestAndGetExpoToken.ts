import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

export const requestAndGetExpoToken = async () => {
  const perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token ?? null;
};
