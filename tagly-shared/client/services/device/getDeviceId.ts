import { Platform } from "react-native";
import * as Application from "expo-application";

/**
 * Stable per-install device id for push-token bookkeeping — iOS
 * identifierForVendor / Android SSAID (app-scoped). NOT an advertising id.
 * The backend scopes push-token disables to one device with it (see
 * `OnAppOpenBody.deviceId`): when a device reports notification permission
 * OFF it often has no token to send, so this is the only handle that can
 * find its stored tokens. Null when the platform can't provide one.
 */
export const getDeviceId = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "ios") {
      return await Application.getIosIdForVendorAsync();
    }
    return Application.getAndroidId() ?? null;
  } catch {
    return null;
  }
};
