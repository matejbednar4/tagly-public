import * as Notifications from "expo-notifications";

export const hasNotificationsEnabled = async () => {
  const perm = await Notifications.getPermissionsAsync();

  if (perm.status === "granted") return true;
  if (perm.status === "denied" && !perm.canAskAgain) return false; // User permanently blocked notifications in Settings

  const result = await Notifications.requestPermissionsAsync();
  return result.status === "granted";
};
