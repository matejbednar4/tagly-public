import * as Notifications from "expo-notifications";

/**
 * Current OS notification-permission status, shaped for the on-app-open report
 * (`OnAppOpenBody.pushPermissionGranted`): `true` = granted, `false` = denied
 * OR undetermined — either way this device cannot receive pushes right now, so
 * the backend disables its stored tokens (revoking permission does NOT
 * invalidate an Expo token). Never prompts.
 */
export const getPushPermissionGranted = async (): Promise<boolean> => {
  const perm = await Notifications.getPermissionsAsync();
  return perm.status === "granted";
};
