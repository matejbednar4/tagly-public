import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from "react-native-permissions";
import { Platform } from "react-native";
// Import the local i18n module directly (not the "@tagly/client" barrel) to
// avoid an import cycle, since this file is itself part of @tagly/client.
import { i18n } from "../../i18n";

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "destructive" | "cancel";
};

type CustomAlertFn = (
  title: string,
  message: string,
  buttons?: AlertButton[],
) => void;

const NS = { ns: "photoPermission" } as const;

/** Denied (or permanently blocked) → explain + deep-link to app settings. */
const alertOpenSettings = (customAlert: CustomAlertFn) =>
  customAlert(i18n.t("title", NS), i18n.t("body", NS), [
    { text: i18n.t("openSettings", NS), onPress: () => openSettings() },
    { text: i18n.t("cancel", NS), style: "cancel" },
  ]);

export async function requestPhotoLibraryPermission(
  customAlert: CustomAlertFn,
): Promise<boolean> {
  try {
    // LIMITED = partial access (iOS "selected photos"; Android 14+ "select
    // photos") — the picker works with the user's selection, so it counts as
    // granted on BOTH platforms.
    const perm =
      Platform.OS === "ios"
        ? PERMISSIONS.IOS.PHOTO_LIBRARY
        : Number(Platform.Version) >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;

    const status = await check(perm);
    if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;
    if (status === RESULTS.DENIED) {
      const r = await request(perm);
      if (r === RESULTS.GRANTED || r === RESULTS.LIMITED) return true;
    }

    alertOpenSettings(customAlert);
    return false;
  } catch {
    // Let the picker attempt anyway if permission check fails unexpectedly
    return true;
  }
}
